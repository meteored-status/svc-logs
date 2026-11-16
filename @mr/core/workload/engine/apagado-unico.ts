/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: c9889f37f5a517a1e10e584a17c2b708
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {warning} from "services-comun/modules/utiles/log";

/**
 * Ejecuta una acción de apagado **una sola vez**, aunque se pida por varias vías a la vez (watcher del
 * `shutdown.lock`, cierre del servidor HTTP, señal). Las peticiones posteriores devuelven la misma promesa. Nunca
 * rechaza: un error de la acción se registra con `warning`. Es lo que usa `Engine.solicitarApagado`; vive aparte
 * para poder probarlo sin arrastrar la configuración del pod.
 */
export class ApagadoUnico {
    private promesa: Promise<void>|null;
    private readonly accion: () => Promise<void>;

    /**
     * @param accion - Lo que hay que ejecutar una vez (el `shutdown()` del engine).
     */
    public constructor(accion: () => Promise<void>) {
        this.accion = accion;
        this.promesa = null;
    }

    /**
     * Ejecuta la acción si aún no se había pedido y devuelve la promesa de esa única ejecución.
     */
    public solicitar(): Promise<void> {
        this.promesa ??= this.ejecutar();

        return this.promesa;
    }

    private async ejecutar(): Promise<void> {
        try {
            await this.accion();
        } catch (err) {
            warning("Error en el shutdown del Engine", err);
        }
    }
}
