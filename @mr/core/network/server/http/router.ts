/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 3827e6c24921531a26cf4a79e5684b9a
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.6.29+1-juanmi
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {error} from "services-comun/modules/utiles/log";

import type {Conexion} from "./conexion";
import type {Routes} from "./routes";
import type {Respuesta} from "./respuesta";

/**
 * Contrato que deben implementar los manejadores de error HTTP.
 * Se invoca cuando ningún grupo de rutas ha podido procesar la petición,
 * o cuando el procesamiento lanza una excepción no controlada.
 *
 * @property handleError - Gestiona un error HTTP enviando la respuesta adecuada al cliente.
 *     `conexion` es la respuesta HTTP activa, `status` el código de estado HTTP del error,
 *     `mensaje` un texto descriptivo del error y `extra` información adicional opcional para
 *     depuración.
 */
export interface IErrorHandler {
    handleError: (conexion: Respuesta, status: number, mensaje: string, extra?: unknown) => Promise<number>;
}

/**
 * Contrato que deben implementar los manejadores de shutdown HTTP.
 * Se invoca cuando el servidor está en proceso de apagado y no puede atender más peticiones.
 *
 * @property handleShutdown - Notifica al cliente que el servidor está cerrando. `conexion` es la
 *     respuesta HTTP activa.
 */
export interface IShutdownHandler {
    handleShutdown: (conexion: Respuesta) => Promise<number>;
}

/**
 * Despacha una conexión HTTP entrante a través de la tabla de rutas.
 *
 * ### Flujo de ejecución
 * 1. Cede el event loop brevemente (`PromiseDelayed`) para evitar bloquear el hilo
 *    principal en ráfagas de peticiones concurrentes.
 * 2. Evalúa los grupos de rutas con {@link Routes.check}. Si ninguno hace match
 *    (o si `check` lanza una excepción), delega al handler de error del router.
 * 3. El handler de error tiene su propio `.catch` para garantizar que cualquier
 *    fallo en la respuesta de error no se propague al servidor HTTP subyacente.
 *
 * @param handlers - Tabla de rutas con su handler de error asociado.
 * @param conexion - Conexión HTTP entrante a despachar.
 */
export async function route(handlers: Routes, conexion: Conexion): Promise<void> {
    try {
        if (await handlers.check(conexion)) {
            return;
        }
    } catch (err) {
        error("Error en routing", conexion.url, err);
    }

    // Si ninguna ruta hizo match, comprobamos si la URL existe registrada con
    // **otro** método HTTP para responder `405 Method Not Allowed` con la
    // cabecera `Allow:` adecuada. En caso contrario delegamos en el handler
    // genérico de error, que responderá `404 Not Found`.
    try {
        const allowed = handlers.collectAllowedMethods(conexion);
        if (allowed.size > 0 && !allowed.has(conexion.metodo)) {
            conexion.addCustomHeader("Allow", [...allowed].sort().join(", "));
            await conexion.error(405, `Method ${conexion.metodo} Not Allowed`);
            return;
        }
    } catch (err) {
        error("Error calculando Allow (405)", conexion.url, err);
    }

    try {
        await handlers.error.check(conexion);
    } catch (err) {
        error("Error en error handler", conexion.url, err);
    }
}
