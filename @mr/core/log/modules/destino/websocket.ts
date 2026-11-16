/**
 * Editor: Bixus
 * Fecha: Wed, 09 Sep 2026 14:22:56 GMT
 * Hash: 0c8558ac05943784b5e67c9f33caae49
 * Versión: 2026.9.9+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {WSPool} from "@mr/core-network/client/websocket";

import {type IDestinoBufferConfig, DestinoBuffer} from "./base";
import type {IWire} from "../interface";

/**
 * Configuración del destino. Hereda la de {@link DestinoBuffer} —lote, espera, urgencia, pendientes—.
 *
 * @property socket - Dónde escucha la ingesta, **sin la ruta**. Por defecto
 *                    `https://status.meteored.com`, que es producción; ver
 *                    {@link DestinoWebSocket.SOCKET}. Vale `http`/`https`, que `WSPool` convierte a
 *                    `ws`/`wss`.
 * @property ruta   - Se le añade al `socket` para llegar al servicio. Por defecto `/status/external/`;
 *                    ver {@link DestinoWebSocket.url}.
 * @property metodo - Método WebSocket al que se envía. Por defecto `/logs/service/`; está expuesto
 *                    porque el nombre lo decide el servidor y no hay forma de descubrirlo desde aquí.
 */
export interface IDestinoWebSocketConfig extends IDestinoBufferConfig {
    socket?: string;
    ruta?: string;
    metodo?: string;
}

/**
 * Envía los logs a la ingesta de `status-external` por WebSocket.
 *
 * **Es fire-and-forget de principio a fin.** Se usa `WSPool.head()`, que el servidor atiende sin contestar:
 * ni hay acuse de recibo ni forma de saber si el log llegó a Elasticsearch. Es la misma decisión que ya
 * tomaba la ingesta por HTTP —se contesta antes de indexar—, y por el mismo motivo: quien loguea no puede
 * quedarse esperando, y un destino lento o caído no puede propagarse a todos los servicios.
 *
 * **Solo sirve en Node.** `WSPool` arrastra `dd-trace`, `node:crypto` y `services-comun`, que importa
 * `node:os` y `node:cluster`. Para el navegador está {@link DestinoHTTP}, que habla el mismo contrato.
 */
export class DestinoWebSocket extends DestinoBuffer {
    /* STATIC */

    /**
     * Dominio de la ingesta, que es donde publican los servicios del dominio status.
     *
     * Está por defecto porque es el mismo para todos los proyectos que loguean: quien no tenga nada
     * especial que decir no debería tener que decirlo. Se cambia para apuntar a un entorno de pruebas o
     * para ir directo al servicio desde dentro del clúster (`ws://status-external:8080`).
     */
    private static readonly SOCKET = "https://status.meteored.com";

    /** Ruta por la que el VirtualService de Istio manda el upgrade a `status-external`. */
    private static readonly RUTA = "/status/external/";

    /** Método WebSocket de la ingesta, tal y como lo declara `status-external`. Recibe una lista. */
    private static readonly METODO = "/logs/service/";

    /**
     * Compone la URL a la que se abre el socket.
     *
     * **La ruta no es decorativa: es lo que enruta, y omitirla no falla, acierta el servicio
     * equivocado.** El upgrade sale contra un dominio que comparten varios servicios
     * (`status.meteored.com`), y lo único que mira el VirtualService de Istio para decidir a cuál va es la
     * ruta; sin ella se lo queda el servicio por defecto, que es `status-frontend`. O sea que el síntoma
     * de olvidarla no es «no conecta», es que los logs no llegan y no hay nada roto a la vista.
     *
     * Es además lo que permite abrir el socket desde fuera de GKE por nombre de dominio, que es el caso
     * normal de quien loguea: dentro del clúster se puede ir al servicio por su nombre, pero desde fuera
     * solo se llega al dominio compartido.
     */
    private static url(socket: string, ruta: string): string {
        return `${socket.replace(/\/+$/, "")}/${ruta.replace(/^\/+/, "")}`;
    }

    /* INSTANCE */

    private readonly pool: WSPool;
    private readonly metodo: string;

    protected override get destino(): string {
        return this.metodo;
    }

    public constructor({socket = DestinoWebSocket.SOCKET, ruta = DestinoWebSocket.RUTA, metodo = DestinoWebSocket.METODO, ...config}: IDestinoWebSocketConfig = {}) {
        super(config);
        // Una conexión caliente, no las diez de por defecto: aquí no se espera respuesta a nada. Quien
        // impide que se abran más es la cola de la clase base; esto solo evita tener nueve paradas sin usar.
        this.pool = WSPool.get({socket: DestinoWebSocket.url(socket, ruta), minConnections: 1});
        this.metodo = metodo;
    }

    protected override async entregar(lote: IWire[]): Promise<void> {
        // `head()` resuelve en cuanto el JSON está en el buffer del socket, y puede rechazar —sin conexión,
        // o con el circuit breaker abierto—. De ese rechazo se encarga la cola de la clase base.
        await this.pool.head<IWire[]>(this.metodo, lote);
    }

    protected override liberar(): void {
        this.pool.destroy();
    }
}
