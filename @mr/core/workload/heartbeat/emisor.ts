/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 4923626ee717852dd9894522cb5356ae
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Deferred} from "services-comun/modules/utiles/promise";
import {warning} from "services-comun/modules/utiles/log";

import type {ILecturaEstado} from "./estado";
import {type IContextoHeartbeat, construirHeartbeat} from "./payload";
import type {IHeartbeat, IHeartbeatMetricas, TEstadoPod} from "./interface";
import {METODO_HEARTBEAT} from "./interface";
import type {IInstanciaHeartbeat, IServidorCierre} from "./registro";
import type {Sonda} from "./sonda";
import {UnSoloVuelo} from "./vuelo";

/**
 * Hasta cuánto después de crear el emisor se insiste en entregar el primer estado (`arrancando`, `tseq` 0) antes que cualquier
 * transición. Por debajo de los 30 s de `PRIMERA_VISTA_MAX_MS` del receptor: más tarde, el receptor ya no lo emitiría.
 */
export const PRIMER_ESTADO_MAX_MS = 25_000;

/**
 * Lo que el emisor usa de `WSPool` (`@mr/core-network/client/websocket`).
 *
 * @property head - Envía sin esperar respuesta.
 * @property vaciar - Espera a que lo enviado salga del proceso, con un tiempo máximo.
 * @property destroy - Cierra las conexiones y no vuelve a abrirlas.
 */
export interface IPoolHeartbeat {
    head<T>(method: string, params?: T): Promise<void>;
    vaciar(config?: {timeoutMs?: number}): Promise<void>;
    destroy(): void;
}

/**
 * Configuración de {@link Heartbeat}.
 *
 * @property contexto - Lo fijo de cada mensaje; el primer envío espera a que se resuelva (no debe rechazar). En producción puede tardar:
 *   no se emite nada hasta tenerlo.
 * @property pool - Pool WebSocket hacia el receptor.
 * @property sonda - Estado de este proceso; en un pod simple es la fuente del estado.
 * @property fuente - Fuente alternativa del estado (el agregado de los workers en el primario de un cluster).
 * @property metricas - Lee las métricas del proceso en cada envío.
 * @property ahora - Reloj en ms. Por defecto `Date.now`.
 * @property intervaloMs - Periodo del temporizador. Por defecto 1000.
 * @property despedidaMs - Tiempo máximo de `pool.vaciar()` en la despedida. Por defecto 500.
 * @property avisoCadaMs - Separación mínima entre dos `warning` por envíos descartados. Por defecto 60000.
 */
export interface IConfigEmisor {
    contexto: Promise<IContextoHeartbeat>;
    pool: IPoolHeartbeat;
    sonda: Sonda;
    fuente?: () => ILecturaEstado|Promise<ILecturaEstado>;
    metricas: () => IHeartbeatMetricas;
    ahora?: () => number;
    intervaloMs?: number;
    despedidaMs?: number;
    avisoCadaMs?: number;
}

/**
 * Emisor del heartbeat de un pod: cada `intervaloMs` (y de inmediato cuando algo cambia) evalúa el
 * estado y lo manda con `head()`, sin esperar respuesta.
 *
 * - **Un solo envío en vuelo** ({@link UnSoloVuelo}): si el anterior no ha resuelto, el tick se salta y al
 *   resolver se manda **solo la última foto**. Si `head()` falla (circuit breaker abierto, sin conexión),
 *   el heartbeat se descarta —con un `warning` como mucho cada `avisoCadaMs`—; nunca se acumulan.
 * - `seq` crece en cada heartbeat construido, enviado o no: un hueco en el receptor es un descarte.
 * - `tseq`, `anterior` y `desde` llevan la cuenta de las transiciones de estado.
 * - **El primer estado (`arrancando`, `tseq` 0) se entrega antes que cualquier transición**, durante {@link PRIMER_ESTADO_MAX_MS}.
 *   Cada mensaje es una foto y `arrancando` se repite cada segundo mientras dure, pero un pod que está listo antes de su primer
 *   envío (en modo simple, en menos de 1 s), o cuyo primer envío se descarta, mandaba directamente `tseq` 1; el receptor ya no
 *   acepta un `tseq` menor que el que conoce, y la transición `null → arrancando` se perdía (medido en status-backend el
 *   2026-11-13). Así que, mientras no se haya entregado, el ciclo manda antes esa foto de `arrancando`; si no se entrega, no manda
 *   la actual, que sale en el siguiente ciclo. La despedida no espera por esto.
 * - La despedida ({@link despedir}) manda `parado`, vacía el pool y lo destruye.
 */
export class Heartbeat implements IInstanciaHeartbeat {
    private readonly contexto: Promise<IContextoHeartbeat>;
    private readonly pool: IPoolHeartbeat;
    private readonly sonda: Sonda;
    private readonly fuente: () => ILecturaEstado|Promise<ILecturaEstado>;
    private readonly metricas: () => IHeartbeatMetricas;
    private readonly ahora: () => number;
    private readonly intervaloMs: number;
    private readonly despedidaMs: number;
    private readonly avisoCadaMs: number;
    private readonly vuelo: UnSoloVuelo;
    private readonly interrupcion: Deferred<null>;
    private timer: NodeJS.Timeout|null;
    private despedida: Promise<void>|null;
    private terminado: boolean;
    private seq: number;
    private readonly creado: number;
    private primerEstadoEntregado: boolean;
    private estado: TEstadoPod;
    private anterior: TEstadoPod|null;
    private desde: number;
    private tseq: number;
    private ultimaLectura: ILecturaEstado;
    private ultimoAviso: number|null;

    public constructor({contexto, pool, sonda, fuente, metricas, ahora = Date.now, intervaloMs = 1000, despedidaMs = 500, avisoCadaMs = 60000}: IConfigEmisor) {
        this.contexto = contexto;
        this.pool = pool;
        this.sonda = sonda;
        this.fuente = fuente ?? (() => this.sonda.evaluar());
        this.metricas = metricas;
        this.ahora = ahora;
        this.intervaloMs = intervaloMs;
        this.despedidaMs = despedidaMs;
        this.avisoCadaMs = avisoCadaMs;
        this.vuelo = new UnSoloVuelo(() => this.ciclo());
        this.interrupcion = new Deferred<null>();
        this.timer = null;
        this.despedida = null;
        this.terminado = false;
        this.seq = 0;
        this.creado = ahora();
        this.primerEstadoEntregado = false;
        this.estado = "arrancando";
        this.anterior = null;
        this.desde = this.creado;
        this.tseq = 0;
        this.ultimaLectura = {estado: "arrancando", causaDrenado: null};
        this.ultimoAviso = null;
    }

    /**
     * Arranca el temporizador (con `unref`: no mantiene vivo el proceso) y manda ya el primer heartbeat.
     */
    public iniciar(): void {
        if (this.timer !== null || this.terminado) {
            return;
        }
        this.timer = setInterval(() => { this.disparar(); }, this.intervaloMs);
        this.timer.unref();
        this.disparar();
    }

    public setEngine(engine: object): void {
        this.sonda.setEngine(engine);
        this.disparar();
    }

    public marcarEjecutado(): void {
        this.sonda.marcarEjecutado();
        this.disparar();
    }

    public disparar(): void {
        if (!this.terminado && this.despedida === null) {
            this.vuelo.disparar();
        }
    }

    public enlazarServidor(servidor: IServidorCierre): void {
        this.sonda.setConsultaCierre(() => servidor.isShuttingDown());
        servidor.alIniciarCierre(() => { this.alIniciarCierre(); });
        servidor.antesDeSalir(async () => this.despedir());
    }

    /**
     * Se empieza a cerrar por señal: fuerza ya una evaluación, que dirá `drenando` con causa `senal`.
     */
    public alIniciarCierre(): void {
        this.sonda.marcarSenal();
        this.disparar();
    }

    /**
     * Despedida: manda `parado`, vacía el pool y lo destruye. Nunca rechaza; es idempotente.
     */
    public async despedir(): Promise<void> {
        this.despedida ??= this.ejecutarDespedida();

        return this.despedida;
    }

    private async ejecutarDespedida(): Promise<void> {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
        // Si hay una evaluación esperando a `ready()`, no se espera a que acabe: el presupuesto es de 1 s.
        this.interrupcion.resolve(null);
        this.vuelo.disparar();
        await this.vuelo.inactivo();
        try {
            await this.pool.vaciar({timeoutMs: this.despedidaMs});
        } catch {
            // vaciar() no rechaza; por si un pool falso lo hiciera.
        }
        this.pool.destroy();
    }

    private async leer(): Promise<ILecturaEstado> {
        if (this.despedida !== null) {
            return this.ultimaLectura;
        }
        const lectura = await Promise.race([Promise.resolve(this.fuente()), this.interrupcion.promise]);
        if (lectura !== null) {
            this.ultimaLectura = lectura;
        }

        return this.ultimaLectura;
    }

    private async ciclo(): Promise<void> {
        if (this.terminado) {
            return;
        }
        // El contexto puede tardar (en producción espera a los metadatos de GKE, con reintentos): la despedida no lo
        // espera, porque sin contexto no se ha enviado nada y no hay nada que despedir.
        const contexto = await Promise.race([this.contexto, this.interrupcion.promise]);
        if (contexto === null) {
            return;
        }
        const lectura = await this.leer();
        if (this.terminado) {
            return;
        }

        const ahora = this.ahora();
        const estado: TEstadoPod = this.despedida !== null ? "parado" : lectura.estado;
        if (estado !== this.estado) {
            this.anterior = this.estado;
            this.estado = estado;
            this.desde = ahora;
            this.tseq++;
        }
        if (estado === "parado") {
            this.terminado = true;
        }

        if (!this.primerEstadoEntregado && this.tseq > 0 && this.despedida === null && ahora - this.creado < PRIMER_ESTADO_MAX_MS) {
            const primero = await this.enviar(contexto, ahora, {estado: "arrancando", anterior: null, desde: this.creado, tseq: 0, causaDrenado: null, procesos: lectura.procesos});
            if (!primero) {
                return;
            }
        }

        await this.enviar(contexto, ahora, {estado, anterior: this.anterior, desde: this.desde, tseq: this.tseq, causaDrenado: lectura.causaDrenado, procesos: lectura.procesos});
    }

    /**
     * Construye y manda una foto. Cuenta `seq` aunque se descarte. Si se entrega, el primer estado ya no hace falta: o era él, o el
     * receptor ya conoce un `tseq` mayor.
     *
     * @returns `true` si `head()` resolvió.
     */
    private async enviar(contexto: IContextoHeartbeat, ahora: number, foto: Pick<IHeartbeat, "estado"|"anterior"|"desde"|"tseq"|"causaDrenado"|"procesos">): Promise<boolean> {
        this.seq++;
        const mensaje = construirHeartbeat(contexto, {seq: this.seq, ts: ahora, ...foto, metricas: this.metricas()});
        try {
            await this.pool.head(METODO_HEARTBEAT, mensaje);
            this.primerEstadoEntregado = true;

            return true;
        } catch (err) {
            this.avisarDescarte(ahora, err);

            return false;
        }
    }

    private avisarDescarte(ahora: number, err: unknown): void {
        if (this.ultimoAviso !== null && ahora - this.ultimoAviso < this.avisoCadaMs) {
            return;
        }
        this.ultimoAviso = ahora;
        // `WSPool` no distingue un 401 de un fallo de red: undici no da el código del handshake rechazado y ambos llegan
        // como un fallo de conexión. Por eso el aviso nombra las dos causas probables.
        warning("Heartbeat descartado (no se acumulan; puede ser un fallo de red o un rechazo del token con 401, el pool no los distingue):", err instanceof Error ? err.message : err);
    }
}
