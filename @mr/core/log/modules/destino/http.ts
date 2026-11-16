/**
 * Editor: Bixus
 * Fecha: Wed, 09 Sep 2026 14:22:56 GMT
 * Hash: df8562f1ccd62e9921f95b3e0e345181
 * Versión: 2026.9.9+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {type IDestinoBufferConfig, DestinoBuffer} from "./base";
import type {IWire} from "../interface";

/**
 * Configuración del destino. Hereda la de {@link DestinoBuffer} —lote, espera, urgencia, pendientes—.
 *
 * @property url - A dónde se hace el POST. Por defecto
 *                 `https://status.meteored.com/service/logs/service/`; ver {@link DestinoHTTP.URL}.
 */
export interface IDestinoHTTPConfig extends IDestinoBufferConfig {
    url?: string;
}

/**
 * Envía los logs a la ingesta de `status-external` por `POST`, agrupados.
 *
 * Hace lo mismo que {@link DestinoWebSocket} y contra el mismo servicio; lo que cambia es el transporte y,
 * con él, tres cosas que conviene tener delante al elegir:
 *
 * - **Sirve en el navegador.** Solo usa `fetch`, que está en Node y en el navegador, así que no hay que
 *   escribir un destino aparte para cada sitio. El de WebSocket es solo de Node, porque `WSPool` arrastra
 *   `dd-trace`, `node:crypto` y `services-comun`.
 * - **Se sabe si falla.** Un `POST` devuelve un código; el `head()` del WebSocket no devuelve nada. Aquí
 *   un 500 o un 404 se trazan igual que un fallo de red. Sigue sin haber acuse de que el log se *indexó*
 *   —la ingesta contesta antes de indexar—, pero al menos se sabe que llegó.
 * - **No hay conexión que mantener.** Ni reconexión, ni heartbeat, ni quedarse pegado a una réplica
 *   durante nueve minutos, ni conexiones cortadas en cada despliegue. A cambio, cada entrega paga sus
 *   cabeceras y su enrutado; con lotes de cien logs eso es ruido, con logs sueltos no lo sería.
 *
 * Se depura con `curl`, que no es poco.
 */
export class DestinoHTTP extends DestinoBuffer {
    /* STATIC */

    /**
     * A dónde va el POST.
     *
     * **Ojo a la ruta, que no es la del WebSocket.** Los endpoints de logs viven fuera de
     * `/status/external/` a propósito: son `/service/logs/…`, las mismas por las que llevan años entrando
     * los logs de todos los proyectos, y es por ese prefijo por el que el kustomize reparte el tráfico
     * hacia `status-external`.
     */
    private static readonly URL = "https://status.meteored.com/service/logs/service/";

    /* INSTANCE */

    private readonly url: string;

    protected override get destino(): string {
        return this.url;
    }

    public constructor({url = DestinoHTTP.URL, ...config}: IDestinoHTTPConfig = {}) {
        super(config);
        this.url = url;
    }

    protected override async entregar(lote: IWire[]): Promise<void> {
        const respuesta = await fetch(this.url, {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify(lote),
        });

        // El cuerpo se consume aunque no interese: sin leerlo, la conexión no vuelve al pool y se acaban
        // agotando las del agente. Que falle leyéndolo no cambia nada de lo que ya sabemos del envío.
        await respuesta.arrayBuffer().catch(() => undefined);

        // `fetch` **no rechaza por un 4xx ni un 5xx**, solo por un fallo de red. Sin esto, una ingesta
        // devolviendo 500 se vería exactamente igual que una que funciona.
        if (!respuesta.ok) {
            await Promise.reject(new Error(`${respuesta.status} ${respuesta.statusText}`));
        }
    }
}
