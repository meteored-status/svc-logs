/**
 * Editor: Bixus
 * Fecha: Wed, 18 Nov 2026 15:20:23 GMT
 * Hash: 1e5271119d63d1c5495c915046e3dee9
 * Versión: 2026.11.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {WSPool} from "@mr/core-network/client/websocket";

import type {IPoolHeartbeat} from "./despedida";

/**
 * Adapta un `WSPool` a lo que usa el emisor. `get()` lee solo el primer frame y distingue `ok: false` (el servidor no sabe atender
 * el método) de los fallos de red o de tiempo, que rechazan. Avisa con `alConectar` cuando `WSPool.get()` ya tiene conexión, antes de
 * esperar la respuesta.
 */
export function adaptarPool(pool: WSPool): IPoolHeartbeat {
    return {
        head: async (metodo, params) => pool.head(metodo, params),
        get: async (metodo, params, config) => {
            const resultado = await pool.get(metodo, params);
            // `pool.get()` resuelve cuando tiene conexión; la respuesta se espera en el `next()` siguiente.
            config?.alConectar?.();
            const {value: frame} = await resultado.generator.next();
            if (frame === undefined) {
                throw new Error("WebSocket stream ended unexpectedly");
            }

            return frame.message.ok ? {ok: true, data: frame.message.data} : {ok: false, motivo: frame.message.info.message ?? "WebSocket error"};
        },
        vaciar: async (config) => pool.vaciar(config),
        destroy: () => { pool.destroy(); },
    };
}
