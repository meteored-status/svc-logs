/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: f831b660b4a392fdb2dc933731d9b05d
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.14+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EEntorno} from "./interface";
import {type IDestino, type ILog, type ILogEmitido, type IOrigen, ESeveridad, entornoActual} from "./interface";

/**
 * Configuración de un {@link Logger}.
 *
 * @property proyecto - Proyecto al que pertenece el servicio. Es la clave por la que se reparten los
 *                      índices en destino (uno por proyecto) y por la que el panel decide quién puede ver
 *                      qué, así que no es una etiqueta decorativa.
 * @property servicio - Nombre del servicio que escribe.
 * @property destinos - A dónde van los logs. Sin ninguno, `Logger` no falla: descarta. Ver
 *                      {@link Logger.escribir}.
 * @property entorno  - Desarrollo, test o producción. Por defecto se deduce de las constantes que inlina
 *                      el bundler ({@link entornoActual}); se pasa a mano solo cuando no las hay o
 *                      cuando el proceso quiere decir otra cosa.
 * @property pod     - De dónde sale el servicio ({@link IOrigen}). Con esto puestos, `servicio`, `region` y
 *                      `host` salen de ahí y no hace falta darlos sueltos: el `IPodInfo` que cualquier
 *                      servicio del monorepo tiene en su configuración encaja tal cual.
 * @property region   - Dónde corre el proceso: la zona o la región del despliegue.
 * @property host     - La máquina o el pod que escribe.
 *
 * **Los tres sueltos ganan al `pod`**, que es lo que permite quedarse con el resto y corregir uno: el caso
 * real es el `servicio`, que en este monorepo se firma `<namespace>/<nombre>` y eso no sale del pod sino
 * de `DD_SERVICE`/`K8S_NAMESPACE` — variables de entorno que este paquete no puede leer, por lo mismo que
 * no puede leer las otras dos.
 *
 * **Nada de esto tiene valor por defecto, y es a propósito.** `region` y `host` se sacarían en Node de
 * `process.env` y de `os.hostname()`, y este módulo **tiene que poder cargarse en el navegador** — lo
 * comprueba `tsconfig.browser.json`, que corre el primero en el `test` del workspace—, así que ni puede
 * importar `node:os` ni dar por hecho que existe `process`. Quien loguea desde Node pasa el pod; quien
 * loguea desde el navegador no tiene ninguno de los dos, y que falten dice la verdad.
 */
export interface ILoggerConfig {
    proyecto: string;
    destinos: IDestino[];
    pod?: IOrigen;
    servicio?: string;
    entorno?: EEntorno;
    region?: string;
    host?: string;
}

/**
 * El logger de un servicio: recoge lo que se escribe, le pone lo que es común a todos sus logs y lo reparte
 * entre sus destinos.
 *
 * No decide **dónde** acaba nada: eso es de los destinos. Aquí solo está lo que no depende del destino —de
 * quién es el log, desde qué entorno, cuándo se escribió y con qué severidad—, para que no haya que
 * repetirlo en cada uno.
 */
export class Logger {
    /* STATIC */

    public static build(config: ILoggerConfig): Logger {
        return new Logger(config);
    }

    /* INSTANCE */

    private readonly proyecto: string;
    private readonly servicio: string;
    private readonly entorno: EEntorno;
    private readonly region?: string;
    private readonly host?: string;
    private readonly destinos: IDestino[];

    private constructor({proyecto, destinos, pod, servicio, entorno = entornoActual(), region, host}: ILoggerConfig) {
        this.proyecto = proyecto;
        // Lo suelto gana al pod: ver {@link ILoggerConfig}. Sin ninguno de los dos el servicio queda en
        // blanco, que es lo que pasaba antes de que existiera `pod` si alguien no lo pasaba — el tipo ya no
        // lo exige porque el pod es la otra forma de darlo.
        this.servicio = servicio ?? pod?.servicio ?? "";
        this.entorno = entorno;
        this.region = region ?? pod?.zona;
        this.host = host ?? pod?.host;
        this.destinos = destinos;
    }

    public info(tipo: string, mensaje: string, extra?: string[]): void {
        this.escribir({tipo, mensaje, severidad: ESeveridad.INFO, extra});
    }

    public warning(tipo: string, mensaje: string, extra?: string[]): void {
        this.escribir({tipo, mensaje, severidad: ESeveridad.WARNING, extra});
    }

    public error(tipo: string, mensaje: string, extra?: string[]): void {
        this.escribir({tipo, mensaje, severidad: ESeveridad.ERROR, extra});
    }

    public critical(tipo: string, mensaje: string, extra?: string[]): void {
        this.escribir({tipo, mensaje, severidad: ESeveridad.CRITICAL, extra});
    }

    /**
     * Completa el log y lo reparte.
     *
     * **Un destino que falle no puede impedir que los demás reciban**, por eso el `try` por destino. No es
     * defensa contra lo previsible —`IDestino.enviar()` está definido como que no lanza—, es defensa contra
     * un destino mal implementado: si aquí se escapara una excepción, subiría hasta quien escribió el log,
     * que es justo lo que no puede pasar.
     */
    public escribir({tipo, mensaje, severidad = ESeveridad.INFO, extra, timestamp = Date.now()}: ILog): void {
        const log: ILogEmitido = {
            timestamp,
            proyecto: this.proyecto,
            servicio: this.servicio,
            entorno: this.entorno,
            // Una cadena vacía no viaja: es lo que sale de un `process.env` que no está puesto, y un campo
            // vacío en el registro se lee como un dato y no como un hueco.
            ...this.region !== undefined && this.region.length > 0 ? {region: this.region} : {},
            ...this.host !== undefined && this.host.length > 0 ? {host: this.host} : {},
            tipo,
            severidad,
            mensaje,
            ...extra !== undefined && extra.length > 0 ? {extra} : {},
        };

        for (const destino of this.destinos) {
            try {
                destino.enviar(log);
            } catch (err: unknown) {
                console.error("[core-log] Un destino ha lanzado al enviar", err);
            }
        }
    }

    /**
     * Espera a que los destinos entreguen lo que tengan pendiente. El logger **sigue utilizable**.
     *
     * Es lo que hay que esperar antes de dejar morir un proceso que no se apaga del todo —un cronjob que
     * termina su trabajo, un `Engine` que va a bajar—: los destinos agrupan y encolan, así que lo último
     * que se escribe es justo lo que se pierde, y en un cronjob lo último suele ser el resultado.
     *
     * No cierra nada, a diferencia de {@link cerrar}: se puede llamar a mitad y seguir logueando.
     */
    public async vaciar(): Promise<void> {
        await Promise.all(this.destinos.map(async (destino) => destino.vaciar?.()));
    }

    /** Vacía y cierra los destinos que tengan algo que cerrar. Para el apagado del servicio. */
    public async cerrar(): Promise<void> {
        await Promise.all(this.destinos.map(async (destino) => destino.cerrar?.()));
    }
}
