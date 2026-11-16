/**
 * Editor: Bixus
 * Fecha: Mon, 14 Sep 2026 06:38:18 GMT
 * Hash: 600ace4570dc16e83cb99441dbcd986b
 * Versión: 2026.9.14+1-bixus
 * Anterior: 2026.9.9+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {type IDestino, type ILogEmitido, type IWire, ESeveridad} from "../interface";

/**
 * Lo que comparte cualquier destino que agrupe y entregue por red.
 *
 * @property lote           - Cuántos logs, como mucho, van en una misma entrega. Ver
 *                            {@link DestinoBuffer.LOTE}.
 * @property esperaMs       - Cuánto espera un log a que le acompañen otros antes de salir solo. Ver
 *                            {@link DestinoBuffer.ESPERA_MS}.
 * @property inmediatoDesde - Severidad a partir de la cual el lote no espera. Por defecto
 *                            {@link ESeveridad.ERROR}; ver {@link DestinoBuffer.INMEDIATO_DESDE}.
 * @property pendientes     - Techo de logs sin entregar —esperando lote o esperando turno—. Pasado ese
 *                            punto se descartan; ver {@link DestinoBuffer.PENDIENTES}.
 * @property avisoMs        - Cada cuánto, como mucho, se avisa por consola de que no se está pudiendo
 *                            entregar. Ver {@link DestinoBuffer.reportarFallo}.
 */
export interface IDestinoBufferConfig {
    lote?: number;
    esperaMs?: number;
    inmediatoDesde?: ESeveridad;
    pendientes?: number;
    avisoMs?: number;
}

/**
 * Destino que **agrupa** los logs y los entrega de uno en uno, en el orden en que se llenaron.
 *
 * Aquí está todo lo que no depende del transporte —el buffer, la urgencia, la cola, el techo de
 * pendientes y el aviso de fallos—, y de eso hay bastante: las dos primeras versiones del destino de
 * WebSocket se fueron en resolver estos problemas, y ninguno tiene que ver con hablar WebSocket. Lo que
 * cambia de un transporte a otro es {@link entregar}, y a veces {@link liberar}.
 *
 * Esa separación es la que hace que elegir transporte sea barato: cambiar de WebSocket a HTTP es escribir
 * un {@link entregar} distinto, no volver a pensar cuándo sale un log.
 *
 * **No toca nada de Node**, para que sirva también en el navegador.
 */
export abstract class DestinoBuffer implements IDestino {
    /* STATIC */

    /**
     * Logs por entrega.
     *
     * **Lo que ahorra agrupar no está en Elasticsearch**, que ya coalesce por su cuenta —el `BulkAuto` del
     * receptor junta lo que le llega cada segundo—, sino en el camino: sin agrupar, cada log es una
     * entrega con su enrutado, su parseo y **su span de Datadog**. Cincuenta logs eran cincuenta spans.
     */
    private static readonly LOTE = 100;

    /**
     * Cuánto espera un log a que le acompañen otros.
     *
     * Es el precio de agrupar, y se paga en retraso: un log suelto en un servicio tranquilo tarda esto en
     * salir. Un segundo es el mismo orden que el `BulkAuto` del receptor, así que no añade una espera
     * perceptible sobre la que ya había.
     *
     * El coste de verdad no es el retraso, es que **lo que está en el buffer se pierde si el proceso muere
     * de golpe**. Por eso están {@link vaciar} y {@link cerrar}: un apagado ordenado no pierde nada, y solo
     * un `SIGKILL` se lleva hasta un segundo de logs.
     */
    private static readonly ESPERA_MS = 1000;

    /**
     * A partir de aquí, el lote sale sin esperar a llenarse ni a que venza {@link ESPERA_MS}.
     *
     * El log que más falta hace es el que precede a una caída, y es justo el que se quedaría en el buffer.
     * `ERROR` y no `CRITICAL` porque un servicio que se va al suelo casi nunca tiene la deferencia de
     * clasificarse como crítico primero.
     *
     * **Inmediato quiere decir «en el siguiente turno del bucle», no «síncrono»**, y la diferencia importa
     * en los dos sentidos. Por un lado no se pierde nada: la entrega ya era asíncrona —va encadenada en la
     * cola—, así que volcar síncronamente no adelantaría nada, y desde luego no salvaría un proceso que se
     * muere en este mismo tick. Por otro lado se gana lo que preocupaba de esta regla: una tormenta de
     * errores en el mismo tick **sigue saliendo en una sola entrega**, en vez de degenerar en una por
     * error, que es exactamente lo que no quieres cuando algo se está cayendo.
     *
     * Los urgentes van en su propio buffer y **no arrastran a los demás**: lo que estuviera esperando sigue
     * esperando su turno. Se pueden desordenar entre sí y da igual, porque los listados ordenan por
     * `@timestamp`, que lo pone quien escribe el log y no quien lo recibe.
     */
    private static readonly INMEDIATO_DESDE = ESeveridad.ERROR;

    /**
     * Logs sin entregar que se admiten antes de empezar a descartar.
     *
     * Solo se llega aquí cuando el otro extremo no está: mientras responde, el buffer se vacía cada
     * `esperaMs` y la cola se drena tan rápido como se llena. Con la ingesta caída, en cambio, cada entrega
     * tarda lo que tarde el intento, y sin techo un servicio que loguee mucho se comería la memoria
     * guardando logs que nadie va a leer. Llegado el tope se tiran, que es lo que hay que hacer con un log:
     * perderlo es mejor que tumbar el proceso que lo escribió.
     */
    private static readonly PENDIENTES = 1000;

    /** Silencio mínimo entre dos avisos de fallo por consola. */
    private static readonly AVISO_MS = 60000;

    /* INSTANCE */

    private readonly lote: number;
    private readonly esperaMs: number;
    private readonly inmediatoDesde: ESeveridad;
    private readonly maxPendientes: number;
    private readonly avisoMs: number;

    /** Logs normales, esperando a completar lote o a que venza {@link esperaMs}. */
    private readonly buffer: IWire[];

    /** Logs urgentes, esperando solo al siguiente turno del bucle. */
    private readonly urgentes: IWire[];

    /**
     * Cuenta atrás de cada buffer. `undefined` cuando el buffer correspondiente está vacío.
     *
     * Son dos y no una porque los dos buffers salen a ritmos distintos: si lo urgente reprogramara la
     * cuenta atrás de lo normal, adelantaría justo lo que se ha decidido no adelantar.
     *
     * El tipo se saca de `setTimeout` en vez de escribir `NodeJS.Timeout` porque **esto tiene que poder
     * compilar para el navegador**, donde `setTimeout` devuelve un `number` y el namespace `NodeJS` no
     * existe.
     */
    private temporizador?: ReturnType<typeof setTimeout>;

    /** Cuenta atrás de {@link urgentes}. */
    private temporizadorUrgente?: ReturnType<typeof setTimeout>;

    /**
     * Cola de entrega: las entregas se encadenan una detrás de otra en vez de lanzarse a la vez.
     *
     * En el destino de WebSocket esto es lo que garantiza **una sola conexión**: el pool reparte una por
     * petición en vuelo y crea las que le falten, así que lanzar cincuenta entregas a la vez abría
     * cincuenta sockets — medido. En el de HTTP hace lo propio con las conexiones del agente.
     *
     * De propina, los lotes salen en el orden en que se llenaron.
     */
    private cola: Promise<void>;

    /** Logs sin entregar: los de los dos buffers más los de los lotes que están en la {@link cola}. */
    private pendientes: number;

    /** Logs descartados desde el último aviso. Se cuentan para poder decir cuántos van. */
    private descartados: number;

    /** Momento del último aviso por consola. */
    private ultimoAviso: number;

    protected constructor({lote = DestinoBuffer.LOTE, esperaMs = DestinoBuffer.ESPERA_MS, inmediatoDesde = DestinoBuffer.INMEDIATO_DESDE, pendientes = DestinoBuffer.PENDIENTES, avisoMs = DestinoBuffer.AVISO_MS}: IDestinoBufferConfig = {}) {
        this.lote = Math.max(lote, 1);
        this.esperaMs = esperaMs;
        this.inmediatoDesde = inmediatoDesde;
        this.maxPendientes = pendientes;
        this.avisoMs = avisoMs;
        this.buffer = [];
        this.urgentes = [];
        this.cola = Promise.resolve();
        this.pendientes = 0;
        this.descartados = 0;
        this.ultimoAviso = 0;
    }

    /**
     * Entrega un lote. Es lo único que cambia de un transporte a otro.
     *
     * Puede rechazar: de trazarlo con cuentagotas se encarga {@link reportarFallo}, y la cola no se rompe
     * por ello.
     */
    protected abstract entregar(lote: IWire[]): Promise<void>;

    /** Suelta lo que haya que soltar al cerrar. Un transporte sin estado no necesita implementarlo. */
    protected liberar(): void {}

    /** Cómo llamar al destino en los avisos de fallo. */
    protected abstract get destino(): string;

    public enviar(log: ILogEmitido): void {
        if (this.pendientes >= this.maxPendientes) {
            this.reportarFallo(new Error(`Cola llena (${this.maxPendientes} pendientes)`));

            return;
        }

        this.pendientes++;

        if (log.severidad >= this.inmediatoDesde) {
            this.urgentes.push(DestinoBuffer.serializar(log));
            if (this.urgentes.length >= this.lote) {
                this.volcarUrgentes();
            } else if (this.temporizadorUrgente === undefined) {
                this.temporizadorUrgente = this.armar(() => { this.volcarUrgentes(); }, 0);
            }

            return;
        }

        this.buffer.push(DestinoBuffer.serializar(log));
        if (this.buffer.length >= this.lote) {
            this.volcar();
        } else if (this.temporizador === undefined) {
            this.temporizador = this.armar(() => { this.volcar(); }, this.esperaMs);
        }
    }

    /**
     * Vuelca los dos buffers y espera a que salga todo lo que había pendiente. El destino sigue utilizable.
     *
     * Basta con esperar a `cola` **una vez**, y es importante que sea solo una: `despachar()` reasigna
     * `this.cola` encadenando el lote nuevo, así que la que se lee aquí —después de volcar— ya incluye los
     * dos volcados. Un segundo `await` no añadiría garantía, arrastraría además los lotes que otro haya
     * encolado mientras tanto, y eso convertiría en indeterminado lo que este método promete: **lo que
     * estuviera pendiente cuando se llamó**, ni más ni menos.
     */
    public async vaciar(): Promise<void> {
        this.volcarUrgentes();
        this.volcar();
        await this.cola;
    }

    /** Vacía y suelta los recursos del transporte. Lo llama el apagado del servicio. */
    public async cerrar(): Promise<void> {
        await this.vaciar();
        this.liberar();
    }

    /**
     * Pone una cuenta atrás para vaciar un buffer.
     *
     * El `unref()` es para que un buffer a medias no mantenga vivo el proceso: un cronjob que termine con
     * logs sin volcar tiene que poder salir, y de vaciarlo ya se encarga {@link cerrar}. No existe en el
     * navegador, donde tampoco hace falta —allí un temporizador pendiente no impide nada—, de ahí el `?.`.
     */
    private armar(que: () => void, ms: number): ReturnType<typeof setTimeout> {
        const temporizador = setTimeout(que, ms);
        (temporizador as {unref?: () => void}).unref?.();

        return temporizador;
    }

    /** Manda los urgentes como una sola entrega. */
    private volcarUrgentes(): void {
        if (this.temporizadorUrgente !== undefined) {
            clearTimeout(this.temporizadorUrgente);
            this.temporizadorUrgente = undefined;
        }
        this.despachar(this.urgentes);
    }

    /** Manda los normales como una sola entrega. */
    private volcar(): void {
        if (this.temporizador !== undefined) {
            clearTimeout(this.temporizador);
            this.temporizador = undefined;
        }
        this.despachar(this.buffer);
    }

    /**
     * Encola el contenido de un buffer como una entrega y lo deja vacío.
     *
     * Vaciar antes de encolar es lo que permite que las llamadas se solapen —lote lleno, cuenta atrás y
     * cierre pueden coincidir— sin duplicar ni perder nada.
     */
    private despachar(buffer: IWire[]): void {
        if (buffer.length === 0) {
            return;
        }

        const lote = buffer.splice(0, buffer.length);
        // El `catch` va dentro de la cadena para que una entrega fallida no la rompa y deje de salir todo
        // lo que venga detrás.
        this.cola = this.cola
            .then(async () => this.entregar(lote))
            .catch((err: unknown) => { this.reportarFallo(err, lote.length); })
            .finally(() => { this.pendientes -= lote.length; });
    }

    /** Pasa el log a lo que espera el servidor. Es una copia: el `ILogEmitido` ya trae todo puesto. */
    private static serializar(log: ILogEmitido): IWire {
        return {
            timestamp: log.timestamp,
            entorno: log.entorno,
            proyecto: log.proyecto,
            servicio: log.servicio,
            ...log.region !== undefined ? {region: log.region} : {},
            ...log.host !== undefined ? {host: log.host} : {},
            tipo: log.tipo,
            severidad: log.severidad,
            mensaje: log.mensaje,
            ...log.extra !== undefined && log.extra.length > 0 ? {extra: log.extra} : {},
        };
    }

    /**
     * Avisa de que no se está pudiendo entregar, **por consola y con cuentagotas**.
     *
     * Por consola porque avisar con el propio logger sería alimentar el bucle: el aviso volvería a este
     * destino, volvería a fallar y volvería a avisar.
     *
     * Con cuentagotas porque el caso típico de fallo no es un log suelto, es la ingesta caída: sin
     * limitarlo, cada lote escribiría su propia línea de error y el remedio saldría más caro que la
     * avería. Se avisa como mucho una vez cada `avisoMs` y se dice cuántos se han perdido desde el aviso
     * anterior, que es el dato que hace falta.
     *
     * El primer fallo se avisa de inmediato —enterarse tarde de que no se está logueando es justo lo que no
     * se quiere—, así que ese aviso puede decir muy poco aunque detrás venga una avería entera. Por eso el
     * mensaje dice también cuándo será el siguiente: **callarse no significa haberse recuperado**, y sin
     * esa coletilla un «1 log descartado» seguido de silencio se lee como un tropiezo suelto.
     *
     * @param cuantos - Logs que se pierden con este fallo. Uno cuando es un descarte por cola llena, y el
     *                  lote entero cuando lo que falla es la entrega.
     */
    protected reportarFallo(err: unknown, cuantos: number = 1): void {
        this.descartados += cuantos;

        const ahora = Date.now();
        if (ahora - this.ultimoAviso < this.avisoMs) {
            return;
        }
        this.ultimoAviso = ahora;

        const perdidos = this.descartados;
        this.descartados = 0;
        console.error(`[core-log] ${perdidos} log(s) descartados enviando a ${this.destino}; siguiente aviso, como pronto, en ${Math.round(this.avisoMs/1000)}s`, err);
    }
}
