import {formats} from "dd-trace/ext";
import tracer from "dd-trace";
import crypto from "node:crypto";

import {Deferred, PromiseDelayed} from "services-comun/modules/utiles/promise";
import {error} from "services-comun/modules/utiles/log";

import type {IMessageClient, IMessageServerOK, IStreamFrame, MessageServer} from "../../metadata/websocket/message";
import {Result} from "./result";
import {WSConnectionError} from "./error";

/**
 * Estados posibles del circuit breaker del pool.
 * - `Closed` — funcionamiento normal; las peticiones pasan.
 * - `Open` — servidor caído; {@link WSPool.get} falla inmediatamente.
 * - `HalfOpen` — una petición de prueba puede pasar para verificar recuperación.
 */
const enum CircuitState {
    Closed = "closed",
    Open = "open",
    HalfOpen = "half-open",
}

/**
 * Tipo de petición WebSocket enviada por el cliente.
 * - `Get`  — petición normal con respuesta; el servidor ejecuta el handler y responde.
 * - `Head` — fire-and-forget; el servidor ejecuta el handler pero no envía respuesta.
 */
const enum EWSRequestType {
    Get  = "get",
    Head = "head",
}

/**
 * Configuración necesaria para crear o recuperar un {@link WSPool}.
 * @property socket - URL del endpoint WebSocket al que conectarse (p. ej. `"ws://localhost:8080"`).
 * @property minConnections - Número mínimo de conexiones que el pool mantendrá abiertas en todo momento.
 *   Si se omite se aplica el valor por defecto {@link WSPool.MIN_CONNECTIONS}.
 * @property reconnect - Si `true` (valor por defecto), cuando la conexión activa se pierde inesperadamente
 *   los frames pendientes en la cola se descartan y la petición se reenvía automáticamente sobre una conexión
 *   nueva. Si `false`, el error se propaga al consumidor del generator.
 *   Este flag también distingue el singleton: pools con el mismo socket pero distinto valor de `reconnect`
 *   son instancias independientes.
 * @property requestTimeoutMs - Timeout global (ms) para cada petición individual. Si se omite,
 *   se aplica el valor por defecto {@link WSPool.REQUEST_TIMEOUT_MS}. Si se alcanza, el generator
 *   lanza un error sin consumir intentos de reconexión.
 * @property heartbeatTimeoutMs - Timeout (ms) sin recibir mensajes (incluyendo pings `Alive`)
 *   antes de considerar la conexión muerta. Si se omite, {@link WSPool.HEARTBEAT_TIMEOUT_MS}.
 */
interface IWSPoolConfig {
    socket: string;
    minConnections?: number;
    reconnect?: boolean;
    requestTimeoutMs?: number;
    heartbeatTimeoutMs?: number;
}

/**
 * Representa una conexión WebSocket activa dentro del pool.
 * @property i - Índice ordinal de la conexión, único dentro del pool (autoincremental).
 * @property ws - Socket WebSocket nativo asociado a esta entrada.
 * @property eol - Código de cierre WebSocket cuando la conexión ha llegado al final de su vida.
 *   `0` indica que la conexión sigue activa.
 * @property abort - Promesa diferida que se rechaza cuando la conexión se cierra o produce un error.
 *   Permite interrumpir generators que estén esperando mensajes de este socket.
 */
interface ISocketConnection {
    i: number;
    ws: WebSocket;
    eol: number;
    abort: Deferred<never>;
}

/**
 * Pool de conexiones WebSocket reutilizables.
 *
 * Mantiene un mínimo de conexiones pre-establecidas contra un mismo endpoint para
 * reducir la latencia de la primera petición. Las conexiones se gestionan
 * automáticamente: se crean bajo demanda, se reponen al cerrarse y se reciclan
 * periódicamente.
 *
 * ### Uso básico
 * ```ts
 * const pool = WSPool.get({ socket: "ws://localhost:8080" });
 * const result = await pool.get("miMetodo", { foo: "bar" });
 * for await (const frame of result.generator) {
 *     if (!frame.message.ok) throw new Error(frame.message.info.message);
 *     console.log(frame.message.data);
 * }
 * ```
 *
 * ### Streaming
 * El método {@link get} devuelve un {@link Result} que encapsula un `AsyncGenerator<IStreamFrame>`
 * que emite cada frame recibido del servidor hasta que éste señale el fin del stream (`done: true`)
 * o envíe un error (`ok: false`). Puede consumirse con {@link Result.next}, {@link Result.consume}
 * o iterando directamente con `for await…of` sobre `result.generator`.
 *
 * ### Mensajes con buffer binario
 * Si se proporciona un `ArrayBuffer` en {@link get}, se envía como frame binario
 * inmediatamente después del mensaje JSON de petición, siguiendo el protocolo
 * definido en {@link IMessageClient}.
 */
export class WSPool {
    /* STATIC */

    /** Número mínimo de conexiones abiertas por defecto cuando no se especifica en la configuración. */
    private static readonly MIN_CONNECTIONS = 10;

    /** Tiempo máximo (ms) de espera para que un WebSocket complete el handshake de apertura. */
    private static readonly CONNECTION_TIMEOUT_MS = 5000;

    /** Intervalo (ms) con el que se comprueba y rellena el pool hasta el mínimo de conexiones. */
    private static readonly REFILL_INTERVAL_MS = 60000;

    /** Registro global de pools indexado por URL del socket. Garantiza una única instancia por endpoint. */
    private static readonly POOLS: Record<string, WSPool> = {};

    /**
     * Número máximo de intentos de reconexión consecutivos sin progreso (sin frames entregados)
     * antes de abandonar y propagar el error al consumidor.
     * El contador se reinicia cada vez que se entrega al menos un frame, de modo que
     * streams de larga duración con caídas ocasionales pueden seguir reconectando.
     */
    private static readonly MAX_RECONNECT_ATTEMPTS = 3;

    /** Timeout global (ms) para cada petición individual desde el cliente. */
    private static readonly REQUEST_TIMEOUT_MS = 30000;

    /** Timeout (ms) sin recibir actividad (mensaje o ping Alive) antes de considerar la conexión muerta. */
    private static readonly HEARTBEAT_TIMEOUT_MS = 45000;

    /**
     * Tiempo base (ms) de espera entre reintentos de reconexión.
     * Se duplica con cada intento consecutivo (backoff exponencial): 100 ms, 200 ms, 400 ms…
     * hasta el máximo definido por {@link RECONNECT_MAX_MS}.
     */
    private static readonly RECONNECT_BASE_MS = 100;

    /** Tiempo máximo (ms) de espera entre reconexiones, independientemente del número de intentos. */
    private static readonly RECONNECT_MAX_MS = 5000;

    /**
     * Número de fallos de conexión consecutivos necesarios para abrir el circuit breaker.
     * Una vez abierto, {@link get} lanza un error inmediato sin intentar conectar al servidor.
     */
    private static readonly CIRCUIT_FAILURE_THRESHOLD = 5;

    /**
     * Tiempo (ms) que el circuit breaker permanece abierto antes de pasar a `"half-open"`
     * y permitir una petición de prueba para verificar la recuperación del servidor.
     */
    private static readonly CIRCUIT_OPEN_DURATION_MS = 30000;

    /**
     * Obtiene (o crea) el pool asociado al endpoint indicado.
     * Implementa el patrón singleton por socket: llamadas sucesivas con la misma
     * URL devuelven siempre la misma instancia.
     * @param cfg - Configuración del pool.
     * @returns La instancia de {@link WSPool} para ese endpoint.
     */
    public static get(cfg: IWSPoolConfig): WSPool {
        if (cfg.socket.startsWith("http")) {
            cfg.socket = cfg.socket.replace("http", "ws");
        }
        if (!cfg.socket.match(/:\d+$/)) {
            if (cfg.socket.startsWith("wss://")) {
                cfg.socket += ":443";
            } else {
                cfg.socket += ":80";
            }
        }
        return this.POOLS[`${cfg.socket}${cfg.reconnect !== false ? "-reconnect" : ""}`] ??= new WSPool(cfg);
    }

    /* INSTANCE */

    /** URL del endpoint WebSocket gestionado por este pool. */
    private readonly socket: string;

    /** Número mínimo de conexiones que el pool debe mantener abiertas. */
    private readonly minConnections: number;

    /**
     * Indica si el generator debe reconectar automáticamente cuando la conexión activa
     * se cae de forma inesperada. Con `true` se descartan los frames pendientes y se
     * reenvía la petición en una conexión nueva; con `false` el error se propaga al
     * consumidor.
     */
    private readonly reconnect: boolean;

    /** Timeout global configurado para peticiones (ms). */
    private readonly requestTimeoutMs: number;

    /** Timeout de heartbeat configurado (ms). */
    private readonly heartbeatTimeoutMs: number;

    /** Contador autoincremental utilizado para asignar un `i` único a cada conexión. */
    private i: number;

    /** Lista de todas las conexiones activas (tanto ocupadas como disponibles). */
    private readonly connections: ISocketConnection[];

    /** Subconjunto de {@link connections} que están libres y listas para procesar peticiones. */
    private readonly available: ISocketConnection[];

    /** Timer del intervalo periódico de reposición del pool. Se almacena para cancelarlo en {@link destroy}. */
    private readonly refillTimer: NodeJS.Timeout;

    /** Estado actual del circuit breaker. */
    private circuitState: CircuitState;

    /** Fallos de conexión consecutivos desde el último éxito. */
    private circuitFailures: number;

    /** Timestamp (ms) hasta el que el circuit breaker permanece en estado `"open"`. */
    private circuitOpenUntil: number;

    /**
     * Timer de la sonda de fondo que intenta reconectar mientras el circuit breaker
     * está abierto. `undefined` cuando no hay sonda activa.
     */
    private circuitProbeTimer: NodeJS.Timeout | undefined;

    /**
     * Crea un nuevo pool y comienza a pre-poblar las conexiones mínimas.
     * El constructor es privado; usar {@link WSPool.get} para obtener instancias.
     * @param cfg - Configuración del pool.
     */
    private constructor({socket, minConnections=WSPool.MIN_CONNECTIONS, reconnect=true, requestTimeoutMs=WSPool.REQUEST_TIMEOUT_MS, heartbeatTimeoutMs=WSPool.HEARTBEAT_TIMEOUT_MS}: IWSPoolConfig) {
        this.socket = socket;
        this.minConnections = Math.max(minConnections, WSPool.MIN_CONNECTIONS);
        this.reconnect = reconnect;
        this.requestTimeoutMs = requestTimeoutMs;
        this.heartbeatTimeoutMs = heartbeatTimeoutMs;
        this.i = 0;
        this.connections = [];
        this.available = [];
        this.circuitState = CircuitState.Closed;
        this.circuitFailures = 0;
        this.circuitOpenUntil = 0;
        this.circuitProbeTimer = undefined;

        this.refillConnections();
        this.refillTimer = setInterval(()=>{
            this.refillConnections();
        }, WSPool.REFILL_INTERVAL_MS).unref();
    }

    /**
     * Rellena el pool hasta alcanzar {@link minConnections} conexiones activas.
     * Las nuevas conexiones se añaden directamente a {@link available}.
     * Los errores de conexión se ignoran silenciosamente para no interrumpir el flujo.
     */
    private refillConnections(): void {
        for (let i=this.connections.length; i<this.minConnections; i++) {
            this.addConnection()
                .then(connection=>this.available.push(connection))
                .catch(()=>undefined);
        }
    }

    /**
     * Crea y registra una nueva conexión WebSocket.
     *
     * Aplica un timeout de {@link CONNECTION_TIMEOUT_MS} ms: si el handshake no
     * completa en ese tiempo, el socket se cierra y la promesa se rechaza.
     * Una vez abierta, inicializa los listeners de control mediante {@link initConnection}.
     *
     * @returns Promesa que se resuelve con la nueva {@link ISocketConnection}.
     * @throws {Error} Si la conexión tarda demasiado o produce un error.
     */
    private async addConnection(): Promise<ISocketConnection> {
        const i = this.i;
        this.i++;
        const ws = new WebSocket(this.socket);
        ws.binaryType = "arraybuffer";
        const socket = {
            i,
            ws,
            eol: 0,
            abort: new Deferred<never>(),
        } as ISocketConnection;
        socket.abort.promise.catch(()=>undefined);

        const promesa = new Deferred<ISocketConnection>();

        const timeout = setTimeout(() => {
            socket.ws.close();
            promesa.reject(new Error(`WebSocket connection timeout (${WSPool.CONNECTION_TIMEOUT_MS}ms)`));
        }, WSPool.CONNECTION_TIMEOUT_MS);

        const openHandler = () => {
            clearTimeout(timeout);
            socket.ws.removeEventListener("open", openHandler);
            socket.ws.removeEventListener("error", errorHandler);
            this.connections.push(socket);
            promesa.resolve(socket);
            this.initConnection(socket);
        };

        const errorHandler = () => {
            clearTimeout(timeout);
            socket.ws.removeEventListener("open", openHandler);
            socket.ws.removeEventListener("error", errorHandler);
            promesa.reject(new Error(`WebSocket connection error connecting to ${this.socket}`));
        };

        socket.ws.addEventListener("open", openHandler);
        socket.ws.addEventListener("error", errorHandler);

        return promesa.promise;
    }

    /**
     * Registra los listeners de control (mensajes del servidor, cierre y error)
     * sobre una conexión ya abierta.
     *
     * - **message**: procesa pings de liveness (`"Alive"`) y shutdown (`"Shutdown"`)
     *   del servidor. Los mensajes con `id` (respuestas a peticiones) se ignoran aquí.
     * - **close**: limpia listeners, rechaza {@link ISocketConnection.abort} y, si la
     *   conexión no había marcado fin de vida, repone el pool.
     * - **error**: registra el fallo, rechaza {@link ISocketConnection.abort} y elimina
     *   la conexión del pool.
     *
     * @param socket - Conexión sobre la que instalar los listeners.
     */
    private initConnection(socket: ISocketConnection): void {
        let heartbeatTimer: NodeJS.Timeout | undefined;

        const resetHeartbeat = () => {
            if (heartbeatTimer) {
                clearTimeout(heartbeatTimer);
            }
            heartbeatTimer = setTimeout(() => {
                // Timeout de heartbeat: interrumpir streams activos y eliminar del pool.
                // abort.reject() despierta cualquier stream que esté esperando en Promise.race;
                // deleteConnection() lo retira del pool y cierra el socket si está en available.
                socket.abort.reject(new Error("Heartbeat timeout"));
                this.deleteConnection(socket, 1000);
            }, this.heartbeatTimeoutMs);
        };

        const messageHandler = (event: MessageEvent)=> {
            resetHeartbeat(); // Cualquier mensaje (incluyendo Alive) resetea el heartbeat

            // Los frames binarios son siempre respuesta a peticiones activas; ignorar aquí
            if (event.data instanceof ArrayBuffer) {
                return;
            }
            let msg: MessageServer;
            try {
                msg = JSON.parse(event.data as string);
            } catch {
                return;
            }

            // Ignorar mensajes que tengan id (son de alguna petición)
            if (msg.id) {
                return;
            }
            if (!msg.ok) {
                this.deleteConnection(socket, 1000);
            }
        }

        const closeHandler = (event: CloseEvent)=>{
            // console.log('WebSocket connection closed:', event.code, event.reason);
            if (heartbeatTimer) {
                clearTimeout(heartbeatTimer);
            }
            socket.ws.removeEventListener("message", messageHandler);
            socket.ws.removeEventListener('close', closeHandler);
            socket.ws.removeEventListener('error', errorHandler);
            socket.abort.reject(new Error(`WebSocket closed: ${event.code} ${event.reason}`));
            if (socket.eol === 0) {
                this.deleteConnection(socket, event.code ?? 1001);
            }
        }

        const errorHandler = (event: Event)=>{
            if (heartbeatTimer) {
                clearTimeout(heartbeatTimer);
            }
            // Solo loguear si la reconexión está deshabilitada; si está habilitada,
            // el mecanismo de reconexión en stream() manejará el error.
            if (!this.reconnect) {
                if ("message" in event) {
                    error("WebSocket error:", event.message);
                } else {
                    error("WebSocket error:", JSON.stringify(event));
                }
            }
            socket.abort.reject(new Error(`WebSocket error`));
            this.deleteConnection(socket, 1006);
        }

        // Iniciar heartbeat
        resetHeartbeat();

        // este manejador es para mensajes de control que envía el servidor
        socket.ws.addEventListener("message", messageHandler);
        socket.ws.addEventListener('close', closeHandler);
        socket.ws.addEventListener('error', errorHandler);
    }

    /**
     * Obtiene una conexión disponible del pool.
     * Extrae la última conexión disponible con `pop()` en O(1) o crea una nueva bajo demanda si el pool está vacío.
     *
     * @returns Promesa con la {@link ISocketConnection} seleccionada.
     */
    private async getConnection(): Promise<ISocketConnection> {
        return this.available.pop() ?? await this.addConnection();
    }

    /**
     * Elimina una conexión del pool y lanza una reposición si el pool está por debajo del mínimo.
     *
     * La eliminación es **inmediata**: la conexión sale del pool antes de intentar crear
     * una nueva. Esto evita conexiones zombie cuando `addConnection()` falla (el orden
     * anterior —añadir antes de eliminar— dejaba la conexión cerrada en el pool si el
     * servidor estaba caído y el `.catch()` silenciaba el error sin llamar a la limpieza).
     *
     * @param socket - Conexión a eliminar.
     * @param status - Código WebSocket con el que cerrar el socket (p. ej. `1000`, `1001`, `1006`).
     */
    private deleteConnection(socket: ISocketConnection, status: number): void {
        this.deleteConnectionFinal(socket, status);
        if (this.connections.length < this.minConnections) {
            this.addConnection()
                .then(connection => this.available.push(connection))
                .catch(()=>undefined);
        }
    }

    /**
     * Realiza la eliminación efectiva de una conexión del pool.
     *
     * Actualiza {@link ISocketConnection.eol} con el código de cierre y retira la
     * conexión de {@link connections} y de {@link available}. Si la conexión estaba
     * disponible y su socket aún no está cerrado, lo cierra con código `1000`.
     *
     * Se usa siempre `1000` en lugar del código original porque códigos como `1005`
     * (no status received) y `1006` (abnormal closure) son reservados para uso interno
     * del estándar y lanzarían `InvalidAccessError` si se pasaran a `ws.close()`.
     * Además, si el socket ya está en estado `CLOSING` o `CLOSED` (p. ej. porque el
     * `closeHandler` acaba de dispararse), se omite la llamada para evitar el error.
     *
     * @param socket - Conexión a eliminar definitivamente.
     * @param status - Código WebSocket de cierre (se almacena en `eol` pero no se
     *   reenvía al socket si es un código reservado o el socket ya está cerrado).
     */
    private deleteConnectionFinal(socket: ISocketConnection, status: number): void {
        socket.eol = status;
        let i = this.connections.findIndex(c=>c.i===socket.i);
        if (i>=0) {
            this.connections.splice(i, 1);
        }
        i = this.available.findIndex(c=>c.i===socket.i);
        if (i>=0) {
            this.available.splice(i, 1);
            // Solo cerrar si el socket sigue abierto o conectando.
            // Códigos 1005/1006 son reservados; siempre usamos 1000 para evitar
            // InvalidAccessError en ws.close().
            if (socket.ws.readyState < WebSocket.CLOSING) {
                socket.ws.close(1000);
            }
        }
    }

    /**
     * Lógica común a {@link head} y {@link get}:
     * 1. Comprueba el circuit breaker y lanza si está abierto.
     * 2. Obtiene una conexión del pool (registra fallo en el circuito si falla).
     * 3. Cierra el circuito si estaba en `HalfOpen` y la conexión tuvo éxito.
     * 4. Anota el span Datadog activo con `websocket.method`, `websocket.type` e inyecta
     *    el contexto de traza en un carrier TEXT_MAP listo para incluir en el mensaje JSON.
     *
     * @param method - Nombre del método/acción de la petición.
     * @param type - `EWSRequestType.Get` para peticiones con respuesta, `EWSRequestType.Head` para fire-and-forget.
     * @returns `{ conexion, carrier }` para que el llamador envíe el mensaje.
     */
    private async prepare(method: string, type: EWSRequestType): Promise<{ conexion: ISocketConnection; carrier: Record<string, string> }> {
        if (this.circuitState !== CircuitState.Closed) {
            if (this.circuitState === CircuitState.Open) {
                if (Date.now() < this.circuitOpenUntil) {
                    throw new Error(`Circuit breaker open: ${this.socket} temporalmente no disponible`);
                }
                this.circuitState = CircuitState.HalfOpen;
            }
        }

        let conexion: ISocketConnection;
        try {
            conexion = await this.getConnection();
        } catch (err) {
            this.onCircuitFailure();
            throw err;
        }

        if (this.circuitState === CircuitState.HalfOpen) {
            this.circuitState = CircuitState.Closed;
            this.circuitFailures = 0;
        }

        const activeSpan = tracer.scope().active();
        activeSpan?.setTag("websocket.method", method);
        activeSpan?.setTag("websocket.type", type);
        const carrier: Record<string, string> = {};
        if (activeSpan) {
            tracer.inject(activeSpan, formats.TEXT_MAP, carrier);
        }

        return { conexion, carrier };
    }

    /**
     * Envía una petición fire-and-forget al servidor sin esperar respuesta.
     *
     * A diferencia de {@link get}, este método:
     * - **No retira la conexión del pool**: la envía de vuelta a {@link available}
     *   inmediatamente tras el envío, por lo que la misma conexión puede reutilizarse
     *   en la misma iteración del event loop para otras peticiones.
     * - **No crea un generator**: el servidor recibe el flag `head: true` en el JSON
     *   y, aunque invoca el handler normalmente, silencia cualquier llamada a
     *   `sendRespuesta`/`sendError` — no se transmite ninguna respuesta al cliente.
     * - **Devuelve `Promise<void>`**: resuelve en cuanto el JSON se ha escrito en el
     *   buffer del socket, sin esperar confirmación alguna del servidor.
     *
     * Útil para notificaciones, invalidaciones de caché o cualquier acción donde el
     * resultado no interesa al llamador.
     *
     * @template T - Tipo de los parámetros de la petición.
     * @param method - Nombre del método/acción que el servidor debe ejecutar.
     * @param params - Parámetros opcionales de la petición.
     * @returns Promesa que resuelve cuando el mensaje se ha encolado en el socket,
     *   o rechaza si no hay conexión disponible o el circuit breaker está abierto.
     */
    public async head<T>(method: string, params?: T): Promise<void> {
        const { conexion, carrier } = await this.prepare(method, EWSRequestType.Head);
        try {
            conexion.ws.send(JSON.stringify({
                id: crypto.randomUUID(),
                method,
                buffer: false,
                head: true,
                params,
                _datadog: carrier,
            } as IMessageClient<T>));
        } finally {
            if (conexion.eol === 0) {
                this.available.push(conexion);
            }
        }
    }

    /**
     * Envía una petición al servidor y devuelve un {@link Result} que encapsula
     * el generator de respuestas.
     *
     * Obtiene la primera conexión de forma síncrona antes de crear el generator,
     * de modo que si el servidor WebSocket está caído la promesa se rechaza
     * inmediatamente con el error de conexión, sin necesidad de iterar el generator.
     *
     * Anota el span HTTP activo con `websocket.method` e inyecta su contexto de traza
     * en el mensaje para propagación distribuida al servidor.
     *
     * @template T - Tipo de los parámetros de la petición.
     * @param method - Nombre del método/acción que el servidor debe ejecutar.
     * @param params - Parámetros opcionales de la petición.
     * @param buffer - Buffer binario opcional que se enviará tras el mensaje JSON.
     * @returns Promesa que se resuelve con el {@link Result} o se rechaza si no hay
     *   conexión disponible.
     */
    public async get<T>(method: string, params?: T, buffer?: ArrayBuffer): Promise<Result> {
        const { conexion, carrier } = await this.prepare(method, EWSRequestType.Get);
        return new Result(this.trackCircuit(this.stream<T>(conexion, method, params, buffer, carrier)));
    }

    /**
     * Envuelve el generator de stream para registrar éxitos y fallos en el circuit breaker.
     * Solo los errores de tipo {@link WSConnectionError} (caída de red) incrementan el contador;
     * los timeouts de petición no abren el circuito.
     */
    private async *trackCircuit(gen: AsyncGenerator<IStreamFrame, void, unknown>): AsyncGenerator<IStreamFrame, void, unknown> {
        try {
            yield* gen;
            // Completado sin error: resetear fallos consecutivos
            this.circuitFailures = 0;
        } catch (err) {
            if (err instanceof WSConnectionError) {
                this.onCircuitFailure();
            }
            throw err;
        }
    }

    /**
     * Registra un fallo de conexión de red.
     * Si se supera {@link CIRCUIT_FAILURE_THRESHOLD} fallos consecutivos, abre el circuit breaker
     * e inicia una sonda de fondo para detectar la recuperación del servidor.
     */
    private onCircuitFailure(): void {
        this.circuitFailures++;
        if (this.circuitFailures >= WSPool.CIRCUIT_FAILURE_THRESHOLD) {
            this.circuitState = CircuitState.Open;
            this.circuitOpenUntil = Date.now() + WSPool.CIRCUIT_OPEN_DURATION_MS;
            this.circuitFailures = 0;
            this.startCircuitProbe();
        }
    }

    /**
     * Inicia (o continúa) la sonda de fondo que intenta reconectar mientras el circuito
     * está abierto. Usa backoff exponencial con el mismo parámetro que la reconexión
     * de streams (`RECONNECT_BASE_MS`, tope `CIRCUIT_OPEN_DURATION_MS`).
     *
     * Cuando la conexión de prueba tiene éxito:
     * - La conexión se añade a {@link available} para uso inmediato.
     * - El circuito pasa a `Closed` y los contadores se reinician.
     *
     * Si el intento falla, se programa otro con mayor backoff hasta que el servidor
     * responda o el pool sea destruido.
     *
     * @param attempt - Número de intento actual (controla el backoff).
     */
    private startCircuitProbe(attempt = 0): void {
        if (this.circuitProbeTimer !== undefined) {
            return; // ya hay una sonda en curso
        }
        const delay = Math.min(
            WSPool.RECONNECT_BASE_MS * (2 ** attempt),
            WSPool.CIRCUIT_OPEN_DURATION_MS,
        );
        this.circuitProbeTimer = setTimeout(() => {
            this.circuitProbeTimer = undefined;
            if (this.circuitState !== CircuitState.Open) {
                return; // el circuito ya se cerró por otro camino
            }
            this.addConnection()
                .then(connection => {
                    this.available.push(connection);
                    this.circuitState = CircuitState.Closed;
                    this.circuitFailures = 0;
                })
                .catch(() => {
                    this.startCircuitProbe(attempt + 1);
                });
        }, delay).unref();
    }

    /**
     * Devuelve el estado actual del circuit breaker.
     * Útil para health checks y dashboards de monitorización.
     */
    public getCircuitState(): CircuitState {
        return this.circuitState;
    }

    /**
     * Implementación interna del streaming de respuestas para una petición concreta.
     *
     * Gestiona el envío de la petición y el consumo de respuestas sobre la conexión
     * proporcionada. Cuando {@link reconnect} es `true` y la conexión cae inesperadamente,
     * descarta los frames pendientes y reenvía la petición en una conexión nueva.
     *
     * **Límite de reconexiones:** si se producen {@link MAX_RECONNECT_ATTEMPTS} caídas
     * consecutivas sin que se entregue ningún frame al consumidor, el generator lanza
     * un error. El contador se reinicia cada vez que se cede al menos un frame, de
     * modo que streams largos con caídas ocasionales pueden seguir reconectando.
     * Si durante una reconexión `getConnection()` falla (servidor caído), el error se
     * propaga directamente sin consumir intentos adicionales.
     *
     * **Timeout global:** abarca todos los reintentos. Si expira, el error se propaga
     * sin intentar reconectar (el servidor está activo pero lento; reconectar duplicaría
     * la petición). El timer se cancela en el `finally` exterior, incluyendo el caso
     * en que el consumidor interrumpe la iteración con `break` / `.return()`.
     *
     * Flujo interno por intento:
     * 1. Registra un listener de mensajes que encola los frames destinados a este UUID.
     * 2. Envía el mensaje JSON (con `_datadog` para propagación de traza) y el buffer binario si se proporcionó.
     * 3. Cede (`yield`) cada {@link IStreamFrame} de la cola hasta que `streamDone` sea `true`.
     * 4. Usa `Promise.race` entre la llegada de nuevos mensajes, {@link ISocketConnection.abort}
     *    y el timeout global para detectar cierres o expiración.
     * 5. Si el socket se cierra y `reconnect === true`, descarta la cola y repite desde el paso 1.
     *    Si `reconnect === false`, se supera el límite o expira el timeout, propaga el error.
     *
     * @template T - Tipo de los parámetros de la petición.
     * @param conexion - Primera conexión WebSocket, obtenida por {@link get} antes de crear el generator.
     * @param method - Nombre del método/acción.
     * @param params - Parámetros opcionales.
     * @param buffer - Buffer binario opcional.
     * @param carrier - Contexto de traza de Datadog serializado (TEXT_MAP) para propagar al servidor.
     * @yields {@link IStreamFrame} con el mensaje y, si aplica, el frame binario asociado.
     */
    private async *stream<T>(conexion: ISocketConnection, method: string, params?: T, buffer?: ArrayBuffer, carrier?: Record<string, string>): AsyncGenerator<IStreamFrame, void, unknown> {
        const uuid: string = crypto.randomUUID();

        // Anotar el span HTTP activo con la información de esta petición WebSocket
        const activeSpan = tracer.scope().active();
        activeSpan?.setTag("websocket.id", uuid);

        let reconnectAttempts = 0;

        // Timeout global cancelable para toda la petición (incluidos reintentos).
        // Usar un Deferred permite limpiar el timer en el finally y distinguir el timeout
        // de una caída de red para evitar reconectar (lo que duplicaría la petición).
        let timeoutFired = false;
        const requestTimeoutDeferred = new Deferred<never>();
        requestTimeoutDeferred.promise.catch(() => undefined); // evitar unhandled rejection
        const requestTimeoutTimer = setTimeout(() => {
            timeoutFired = true;
            requestTimeoutDeferred.reject(new Error(`WebSocket request timeout (${this.requestTimeoutMs}ms) for method ${method}`));
        }, this.requestTimeoutMs);

        try {
            while (true) {
                const queue: IStreamFrame[] = [];
                let notify = new Deferred<void>();
                let streamDone = false;
                let pendingMsg: MessageServer | undefined;
                let shouldReconnect = false;

                const messageHandler = (event: MessageEvent) => {
                    // Frame binario: completa el IStreamFrame del mensaje que esperaba buffer
                    if (event.data instanceof ArrayBuffer) {
                        if (pendingMsg) {
                            queue.push({ message: pendingMsg, buffer: event.data });
                            if (!pendingMsg.ok || (pendingMsg as IMessageServerOK).done) {
                                streamDone = true;
                            }
                            pendingMsg = undefined;
                            notify.resolve();
                        }
                        return;
                    }

                    let msg: MessageServer;
                    try {
                        msg = JSON.parse(event.data as string);
                    } catch {
                        return;
                    }

                    // Ignorar mensajes que no son de esta petición
                    if (msg.id !== uuid) {
                        return;
                    }

                    // Si el mensaje anuncia un frame binario, retenerlo hasta recibir el frame
                    if (msg.ok && (msg as IMessageServerOK).buffer) {
                        pendingMsg = msg;
                        return;
                    }

                    // Mensaje sin frame binario: encolar directamente
                    queue.push({ message: msg });

                    // Fin del stream: error o última respuesta
                    if (!msg.ok || (msg as IMessageServerOK).done) {
                        streamDone = true;
                    }

                    // Despertar al generator
                    notify.resolve();
                };

                conexion.ws.addEventListener("message", messageHandler);

                try {
                    // Enviar petición
                    conexion.ws.send(JSON.stringify({
                        id: uuid,
                        method,
                        buffer: buffer !== undefined,
                        params,
                        _datadog: carrier,
                    } as IMessageClient<T>));

                    if (buffer) {
                        conexion.ws.send(buffer);
                    }

                    // Consumir respuestas hasta que el servidor señale fin
                    let dropError: Error | undefined;
                    while (!dropError) {
                        if (queue.length === 0 && !streamDone) {
                            const waiter = new Deferred<void>();
                            notify = waiter;
                            // Recomprobar DESPUÉS de asignar
                            if (queue.length === 0 && !streamDone) {
                                try {
                                    await Promise.race([
                                        waiter.promise,
                                        conexion.abort.promise,
                                        requestTimeoutDeferred.promise,
                                    ]);
                                } catch (err) {
                                    if (timeoutFired) {
                                        // Timeout global: error definitivo, no reconectar
                                        dropError = err instanceof Error ? err : new Error(`WebSocket request timeout (${this.requestTimeoutMs}ms) for method ${method}`);
                                    } else if (this.reconnect) {
                                        // Caída de red: reconectar si no se superó el límite
                                        if (++reconnectAttempts > WSPool.MAX_RECONNECT_ATTEMPTS) {
                                            dropError = new WSConnectionError(`WebSocket: límite de reconexiones alcanzado (${WSPool.MAX_RECONNECT_ATTEMPTS}) para el método ${method}`);
                                        } else {
                                            shouldReconnect = true;
                                        }
                                    } else {
                                        dropError = new WSConnectionError(`WebSocket connection dropped (method: ${method})`);
                                    }
                                    break;
                                }
                            }
                        }
                        while (queue.length > 0) {
                            reconnectAttempts = 0; // progreso real → resetear contador
                            yield queue.shift()!;
                        }
                        if (streamDone && queue.length === 0) {
                            break;
                        }
                    }

                    if (dropError) {
                        activeSpan?.setTag("error", dropError);
                        throw dropError;
                    }
                } finally {
                    // Siempre liberar el listener
                    conexion.ws.removeEventListener("message", messageHandler);
                    if (conexion.eol === 0 && !shouldReconnect) {
                        // Completado con éxito: devolver la conexión al pool
                        this.available.push(conexion);
                    } else if (conexion.eol > 0) {
                        // Conexión marcada como EOL (heartbeat timeout, shutdown, etc.):
                        // closeHandler no la cerrará si estaba en uso, así que lo hacemos aquí
                        conexion.ws.close(conexion.eol);
                    }
                    // shouldReconnect && eol===0: caída de red → closeHandler ya gestionó el socket
                }

                if (!shouldReconnect) {
                    break;
                }

                // Reconectar: reintentar con backoff exponencial hasta conseguir conexión
                // o agotar el timeout global de la petición.
                //
                // Si el servidor está reiniciando y aún no acepta conexiones, en lugar de
                // fallar en el primer intento el bucle sigue esperando con backoff creciente
                // (100 ms, 200 ms, 400 ms… hasta RECONNECT_MAX_MS) y respeta el presupuesto
                // total de requestTimeoutMs usando Promise.race en cada espera.
                {
                    let reconnected = false;
                    while (!reconnected) {
                        const baseDelay = Math.min(
                            WSPool.RECONNECT_BASE_MS * (2 ** (reconnectAttempts - 1)),
                            WSPool.RECONNECT_MAX_MS,
                        );
                        // Esperar con backoff; salir inmediatamente si el timeout global disparó
                        try {
                            await Promise.race([
                                PromiseDelayed(baseDelay + Math.floor(Math.random() * baseDelay * 0.2)),
                                requestTimeoutDeferred.promise,
                            ]);
                        } catch {
                            throw new Error(`WebSocket request timeout (${this.requestTimeoutMs}ms) for method ${method}`);
                        }
                        try {
                            conexion = await this.getConnection();
                            reconnected = true;
                        } catch {
                            // Servidor aún no disponible: backoff más largo en el siguiente intento.
                            // Sin límite de intentos aquí; solo el timeout global acota el tiempo total.
                            reconnectAttempts++;
                        }
                    }
                }
            }
        } finally {
            // Cancelar el timer en cualquier caso de salida: éxito, error o .return() del consumer
            clearTimeout(requestTimeoutTimer);
        }
    }

    /**
     * Destruye el pool: cierra todas las conexiones activas, cancela el timer de
     * reposición y elimina la instancia del registro global de singletons.
     *
     * Útil para liberar recursos al finalizar tests o durante el shutdown graceful
     * del proceso. Las peticiones en curso recibirán un error de cierre cuando sus
     * conexiones se cierren.
     *
     * Tras llamar a `destroy()`, cualquier llamada posterior a {@link WSPool.get}
     * con la misma configuración creará un pool nuevo desde cero.
     *
     * @param code - Código WebSocket con el que cerrar las conexiones (por defecto `1000`).
     * @param reason - Razón adjunta al cierre (por defecto `"Pool destroyed"`).
     */
    public destroy(code = 1000, reason = "Pool destroyed"): void {
        clearInterval(this.refillTimer);
        if (this.circuitProbeTimer !== undefined) {
            clearTimeout(this.circuitProbeTimer);
            this.circuitProbeTimer = undefined;
        }

        for (const socket of this.connections) {
            socket.ws.close(code, reason);
        }
        this.connections.length = 0;
        this.available.length = 0;

        // Eliminar del registro global para que la próxima llamada a get() cree un pool nuevo
        const key = `${this.socket}${this.reconnect ? "-reconnect" : ""}`;
        delete WSPool.POOLS[key];
    }
}
