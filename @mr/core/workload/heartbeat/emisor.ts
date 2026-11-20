/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: d67e42f5abe4a3649a900ae832016736
 * Versión: 2026.11.20+1-bixus
 * Anterior: 2026.11.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Deferred} from "services-comun/modules/utiles/promise";
import {info, warning} from "services-comun/modules/utiles/log";

import type {ILecturaEstado} from "./estado";
import {type IPoolHeartbeat, type IRelojDespedida, PRESUPUESTO_DESPEDIDA_FINITA_MS, PRESUPUESTO_DESPEDIDA_MS, despedirConfirmado} from "./despedida";
import {type IContextoHeartbeat, construirHeartbeat} from "./payload";
import type {IHeartbeat, IHeartbeatMetricas, TEstadoPod, TResultadoEjecucion} from "./interface";
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
 * Lo máximo que un arranque fallido espera al primer envío antes de salir (ver {@link Heartbeat.esperarPrimerEnvio}).
 */
export const PRIMER_ENVIO_ESPERA_MAX_MS = 1000;

export type {IPoolHeartbeat} from "./despedida";

/**
 * El reloj de verdad de la despedida: `Date.now` y `setTimeout` (cancelable).
 */
const RELOJ_REAL: IRelojDespedida = {
    ahora: () => Date.now(),
    temporizador: (ms) => {
        const deferred = new Deferred<void>();
        const timer = setTimeout(() => { deferred.resolve(); }, ms);

        return {promesa: deferred.promise, cancelar: () => { clearTimeout(timer); }};
    },
};

/**
 * Hasta cuándo, como mucho, espera la despedida a un envío que ya estaba en vuelo. Si `head()` de ese ciclo está atascado
 * (una reconexión de hasta 5 s) no se espera: el `parado` sale por su cuenta. Es el arreglo del fallo del 2026-11-18, en que la
 * despedida se quedaba esperando a ese ciclo y `antesDeSalir` se agotaba antes de mandar nada.
 */
export const ESPERA_VUELO_MAX_MS = 100;

/**
 * Cómo acabó la ejecución de una carga finita, que la despedida lleva en `ejecucion`.
 *
 * @property resultado - `ok` o `error`. Si la ejecución recibió la señal, el `parado` no lo lleva (ver {@link Heartbeat.despedir}).
 * @property error - `err.name` (nunca el mensaje) con `resultado` `error`; `null` si no.
 */
export interface IResultadoDespedida {
    resultado: TResultadoEjecucion;
    error: string|null;
}

/**
 * Configuración de {@link Heartbeat}.
 *
 * @property contexto - Lo fijo de cada mensaje; el primer envío espera a que se resuelva (no debe rechazar). En producción puede tardar:
 *   no se emite nada hasta tenerlo.
 * @property pool - Pool WebSocket hacia el receptor.
 * @property abrirNuevo - Fábrica de un pool de un solo uso, con conexión nueva, para reintentar la despedida (ver {@link despedirConfirmado}).
 * @property sonda - Estado de este proceso; en un pod simple es la fuente del estado.
 * @property fuente - Fuente alternativa del estado (el agregado de los workers en el primario de un cluster).
 * @property metricas - Lee las métricas del proceso en cada envío.
 * @property ahora - Reloj en ms. Por defecto `Date.now`.
 * @property intervaloMs - Periodo del temporizador. Por defecto 1000.
 * @property despedidaMs - Tiempo máximo de `pool.vaciar()` en la despedida. Por defecto 500.
 * @property presupuestoDespedidaMs - Tiempo total de la despedida desde `despedir()`. Por defecto {@link PRESUPUESTO_DESPEDIDA_MS}.
 * @property finita - Es una carga finita (cronjob o job). Fuera del camino de una señal su despedida espera al contexto (ver
 *   `presupuestoDespedidaFinitaMs`) en vez de abandonar si aún no está. Por defecto `false`.
 * @property presupuestoDespedidaFinitaMs - Tiempo total de la despedida de una carga finita fuera del camino de una señal. Por defecto
 *   {@link PRESUPUESTO_DESPEDIDA_FINITA_MS}.
 * @property esperaVueloMs - Lo máximo que la despedida espera a un envío en vuelo. Por defecto {@link ESPERA_VUELO_MAX_MS}.
 * @property reloj - Reloj de la despedida. Por defecto el real.
 * @property avisoCadaMs - Separación mínima entre dos `warning` por envíos descartados. Por defecto 60000.
 */
export interface IConfigEmisor {
    contexto: Promise<IContextoHeartbeat>;
    pool: IPoolHeartbeat;
    abrirNuevo: () => IPoolHeartbeat;
    sonda: Sonda;
    fuente?: () => ILecturaEstado|Promise<ILecturaEstado>;
    metricas: () => IHeartbeatMetricas;
    ahora?: () => number;
    intervaloMs?: number;
    despedidaMs?: number;
    presupuestoDespedidaMs?: number;
    finita?: boolean;
    presupuestoDespedidaFinitaMs?: number;
    esperaVueloMs?: number;
    reloj?: IRelojDespedida;
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
 * - La despedida ({@link despedir}) construye el `parado` **una vez** y lo manda con confirmación (`despedida.ts`): espera como
 *   mucho {@link ESPERA_VUELO_MAX_MS} a un envío en vuelo, y reintenta por conexiones nuevas si el receptor no confirma. Destruye los pools.
 */
export class Heartbeat implements IInstanciaHeartbeat {
    private readonly contexto: Promise<IContextoHeartbeat>;
    private readonly pool: IPoolHeartbeat;
    private readonly abrirNuevo: () => IPoolHeartbeat;
    private readonly sonda: Sonda;
    private readonly fuente: () => ILecturaEstado|Promise<ILecturaEstado>;
    private readonly metricas: () => IHeartbeatMetricas;
    private readonly ahora: () => number;
    private readonly intervaloMs: number;
    private readonly despedidaMs: number;
    private readonly presupuestoDespedidaMs: number;
    private readonly finita: boolean;
    private readonly presupuestoDespedidaFinitaMs: number;
    private readonly esperaVueloMs: number;
    private readonly reloj: IRelojDespedida;
    private readonly avisoCadaMs: number;
    private readonly vuelo: UnSoloVuelo;
    private readonly interrupcion: Deferred<null>;
    private readonly primerEnvio: Deferred<void>;
    private timer: NodeJS.Timeout|null;
    private despedida: Promise<void>|null;
    private senal: boolean;
    private contextoResuelto: IContextoHeartbeat|null;
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

    public constructor({contexto, pool, abrirNuevo, sonda, fuente, metricas, ahora = Date.now, intervaloMs = 1000, despedidaMs = 500, presupuestoDespedidaMs = PRESUPUESTO_DESPEDIDA_MS, finita = false, presupuestoDespedidaFinitaMs = PRESUPUESTO_DESPEDIDA_FINITA_MS, esperaVueloMs = ESPERA_VUELO_MAX_MS, reloj = RELOJ_REAL, avisoCadaMs = 60000}: IConfigEmisor) {
        this.contexto = contexto;
        this.pool = pool;
        this.abrirNuevo = abrirNuevo;
        this.sonda = sonda;
        this.fuente = fuente ?? (() => this.sonda.evaluar());
        this.metricas = metricas;
        this.ahora = ahora;
        this.intervaloMs = intervaloMs;
        this.despedidaMs = despedidaMs;
        this.presupuestoDespedidaMs = presupuestoDespedidaMs;
        this.finita = finita;
        this.presupuestoDespedidaFinitaMs = presupuestoDespedidaFinitaMs;
        this.esperaVueloMs = esperaVueloMs;
        this.reloj = reloj;
        this.avisoCadaMs = avisoCadaMs;
        this.vuelo = new UnSoloVuelo(() => this.ciclo());
        this.interrupcion = new Deferred<null>();
        this.primerEnvio = new Deferred<void>();
        this.timer = null;
        this.despedida = null;
        this.senal = false;
        this.contextoResuelto = null;
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

    /**
     * Espera a que el primer envío haya terminado (entregado o descartado) **y a que el frame haya salido del proceso**, o a que pasen
     * `maxMs` en total, lo que ocurra antes. Para un arranque que va a morir: el `arrancando` tiene que haber salido antes de
     * `process.exit`. Que `head()` resuelva no basta: lo hace en cuanto `ws.send()` ha encolado el mensaje, y un `exit` en ese mismo
     * encadenado lo pierde (medido: 0 frames de 27 arranques fallidos). Por eso, tras el envío, se espera con `pool.vaciar()` a que el
     * buffer de salida esté vacío (`bufferedAmount === 0`). No manda nada por su cuenta y no rechaza.
     *
     * @param maxMs - Tope de la espera, handshake incluido.
     */
    public async esperarPrimerEnvio(maxMs: number): Promise<void> {
        const inicio = this.reloj.ahora();
        const limite = this.reloj.temporizador(maxMs);
        try {
            await Promise.race([this.primerEnvio.promise, limite.promesa]);
            const resto = maxMs - (this.reloj.ahora() - inicio);
            if (resto > 0) {
                await Promise.race([this.pool.vaciar({timeoutMs: resto}), limite.promesa]);
            }
        } catch {
            // vaciar() no rechaza; por si un pool falso lo hiciera.
        } finally {
            limite.cancelar();
        }
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
        this.senal = true;
        this.sonda.marcarSenal();
        this.disparar();
    }

    /**
     * Despedida: manda `parado` con confirmación y destruye los pools. Nunca rechaza; es idempotente (manda la primera llamada).
     *
     * Con `ejecucion` (una carga finita que acaba) el `parado` lleva el `resultado` y el `error` en su `ejecucion`, **salvo si hubo señal**
     * (`alIniciarCierre`) durante la ejecución: entonces va con `resultado` `null` y `causaDrenado` `senal` (el receptor lo guarda como
     * `cortada`, también si la ejecución falló después de recibir el aviso). La causa se fuerza en **toda** carga finita con señal, también
     * si se despide sin `ejecucion` (desde `antesDeSalir`): sin ella, el receptor la guardaría como `sin-despedida`. Una carga finita
     * que se despide por su cuenta, sin señal de por medio, espera al contexto hasta {@link PRESUPUESTO_DESPEDIDA_FINITA_MS} en
     * vez de abandonar si aún no está resuelto; tras una señal (`alIniciarCierre`) se comporta como un servicio.
     *
     * @param ejecucion - Cómo acabó la ejecución, solo en una carga finita.
     */
    public async despedir(ejecucion?: IResultadoDespedida): Promise<void> {
        this.despedida ??= this.ejecutarDespedida(ejecucion);

        return this.despedida;
    }

    private async ejecutarDespedida(ejecucion?: IResultadoDespedida): Promise<void> {
        const inicio = this.reloj.ahora();
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
        // Si hay una evaluación esperando a `ready()`, no se espera a que acabe: el presupuesto es de 1 s.
        this.interrupcion.resolve(null);
        await this.esperarVuelo();

        // Una carga finita que acaba por su cuenta espera al contexto: una ejecución corta puede acabar antes que los metadatos de GKE, y
        // sin contexto no hay `parado`. Se reserva el presupuesto del envío: el total no pasa de `presupuestoDespedidaFinitaMs`.
        const esperaContexto = this.finita && !this.senal;
        // Sin contexto no se ha enviado nada y no hay nada que despedir. Si ya está resuelto aunque ningún ciclo lo haya leído, se usa.
        const contexto = this.contextoResuelto ?? (esperaContexto ? await this.esperarContexto(inicio) : await Promise.race([this.contexto, this.interrupcion.promise]));
        if (contexto === null) {
            try {
                await this.pool.vaciar({timeoutMs: this.despedidaMs});
            } catch {
                // vaciar() no rechaza; por si un pool falso lo hiciera.
            }
            this.pool.destroy();

            return;
        }

        // El `parado` se construye una vez: todos los intentos mandan el mismo (mismo `seq`), así que repetirlo es inocuo.
        const ahora = this.ahora();
        const lectura = this.ultimaLectura;
        this.anterior = this.estado;
        this.estado = "parado";
        this.desde = ahora;
        this.tseq++;
        this.terminado = true;
        this.seq++;
        // Una ejecución finita que ha recibido la señal (Kubernetes la corta por `activeDeadlineSeconds` o la evicta) consta como cortada aunque
        // `ejecutar()` haya resuelto o fallado al atender el aviso: el `parado` no declara resultado y lleva la causa `senal`, que es lo que el
        // receptor traduce a `cortada`. La causa se fuerza porque el ciclo que la evaluaría puede no haber corrido todavía, y en toda carga finita
        // con señal, también la que se despide sin `ejecucion` (desde `antesDeSalir`): sin causa, un `parado` sin resultado es `sin-despedida`.
        const cortada = this.finita && this.senal;
        const contextoFinal: IContextoHeartbeat = ejecucion !== undefined && contexto.ejecucion !== undefined
            ? {...contexto, ejecucion: {...contexto.ejecucion, resultado: cortada ? null : ejecucion.resultado, error: !cortada && ejecucion.resultado === "error" ? ejecucion.error : null}}
            : contexto;
        if (cortada && ejecucion?.resultado === "error") {
            info(`Heartbeat: la ejecución falló (${ejecucion.error ?? "Error"}) tras recibir la señal: se despide como cortada`);
        }
        const mensaje = construirHeartbeat(contextoFinal, {seq: this.seq, ts: ahora, estado: "parado", anterior: this.anterior, desde: this.desde, tseq: this.tseq, causaDrenado: cortada ? "senal" : lectura.causaDrenado, procesos: lectura.procesos, metricas: this.metricas()});

        const informe = await despedirConfirmado({
            pool: this.pool,
            abrirNuevo: this.abrirNuevo,
            mensaje,
            reloj: this.reloj,
            presupuestoMs: esperaContexto ? this.presupuestoDespedidaMs : Math.max(0, this.presupuestoDespedidaMs - (this.reloj.ahora() - inicio)),
            vaciarMs: this.despedidaMs,
        });
        if (informe.resultado === "sin-confirmar") {
            warning(`Heartbeat: la despedida (parado) no se ha confirmado tras ${informe.intentos} intento(s) y ${informe.ms} ms: ${informe.motivo}`);
        } else if (informe.intentos > 1) {
            info(`Heartbeat: la despedida (parado) se ${informe.resultado === "confirmado" ? "confirmó" : "envió por el método de reserva"} en el intento ${informe.intentos} (${informe.ms} ms)`);
        }
    }

    /**
     * Espera al contexto lo que quede del presupuesto de una carga finita menos el del envío.
     *
     * @param inicio - Hora (del reloj de la despedida) en que empezó la despedida.
     * @returns El contexto, o `null` si no ha resuelto a tiempo.
     */
    private async esperarContexto(inicio: number): Promise<IContextoHeartbeat|null> {
        const espera = Math.max(0, this.presupuestoDespedidaFinitaMs - this.presupuestoDespedidaMs - (this.reloj.ahora() - inicio));
        const limite = this.reloj.temporizador(espera);
        try {
            return await Promise.race([this.contexto, limite.promesa.then(() => null)]);
        } finally {
            limite.cancelar();
        }
    }

    /**
     * Espera a que no quede un envío en vuelo, pero como mucho {@link ESPERA_VUELO_MAX_MS}: un ciclo atascado no puede quitarle
     * a la despedida su presupuesto.
     */
    private async esperarVuelo(): Promise<void> {
        const limite = this.reloj.temporizador(this.esperaVueloMs);
        try {
            await Promise.race([this.vuelo.inactivo(), limite.promesa]);
        } finally {
            limite.cancelar();
        }
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
        this.contextoResuelto = contexto;
        // Una vez iniciada la despedida el `parado` lo manda ella, no un ciclo.
        if (this.despedida !== null) {
            return;
        }
        const lectura = await this.leer();
        if (this.terminado || this.despedida !== null) {
            return;
        }

        const ahora = this.ahora();
        const estado: TEstadoPod = lectura.estado;
        if (estado !== this.estado) {
            this.anterior = this.estado;
            this.estado = estado;
            this.desde = ahora;
            this.tseq++;
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
        // Un ciclo que estaba en vuelo cuando empezó la despedida no puede mandar nada después del `parado`: su `seq` sería mayor.
        if (this.despedida !== null) {
            return false;
        }
        this.seq++;
        const mensaje = construirHeartbeat(contexto, {seq: this.seq, ts: ahora, ...foto, metricas: this.metricas()});
        try {
            await this.pool.head(METODO_HEARTBEAT, mensaje);
            this.primerEstadoEntregado = true;

            return true;
        } catch (err) {
            this.avisarDescarte(ahora, err);

            return false;
        } finally {
            this.primerEnvio.resolve();
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
