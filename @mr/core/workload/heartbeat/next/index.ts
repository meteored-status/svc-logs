/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 14:36:40 GMT
 * Hash: 3748f5f822c1bf295273d4d016884ed6
 * Versión: 2026.11.16+3-bixus
 * Anterior: 2026.11.16+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {crearPodInfo} from "../../config/pod";
import {iniciarHeartbeat} from "../crear";
import {iniciarHeartbeatNextCon} from "./iniciar-next";

/**
 * Plazo de cada autosondeo en desarrollo (`next dev`): mientras Next compila una página tarda más de los 900 ms de producción en contestar y el
 * pod saldría `no-listo` sin estarlo.
 */
const TIMEOUT_SONDA_DESARROLLO_MS = 5000;

/**
 * Arranca el heartbeat de pods de un servicio Next.js. Se llama desde `register()` de `instrumentation.ts`, solo en el
 * runtime de Node:
 *
 * ```ts
 * export async function register(): Promise<void> {
 *     if (process.env["NEXT_RUNTIME"] === "nodejs") {
 *         (await import("@mr/core-workload/heartbeat/next")).iniciarHeartbeatNext();
 *     }
 * }
 * ```
 *
 * Es síncrono, no bloquea el arranque de Next y nunca lanza: el trabajo va en segundo plano y un fallo acaba en un `warning`.
 * Sin `HEARTBEAT=true` no hace nada. **Solo de servidor**: no importarlo desde código compartido con el navegador.
 */
export function iniciarHeartbeatNext(): void {
    void iniciarHeartbeatNextCon({crearPod: crearPodInfo, iniciar: iniciarHeartbeat, timeoutSondaMs: PRODUCCION ? undefined : TIMEOUT_SONDA_DESARROLLO_MS});
}
