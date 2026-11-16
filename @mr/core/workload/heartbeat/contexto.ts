/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 3635dbee33a6c98bdd02ab97c47f82d6
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Deferred} from "services-comun/modules/utiles/promise";
import {info, warning} from "services-comun/modules/utiles/log";

import type {IMetadatosPod} from "./metadatos";
import type {IContextoHeartbeat} from "./payload";

/**
 * Resuelve el contexto fijo del heartbeat cuando están los metadatos del pod.
 *
 * - Al resolverse deja **un `info`** con cluster, proyecto y ubicación y el origen de cada uno.
 * - Si falla —los metadatos o la construcción del contexto— deja **un `warning`** y la promesa **se queda pendiente**:
 *   sin contexto no se emite, y el emisor no espera a que resuelva para despedirse. Nunca rechaza.
 *
 * @param metadatos - Metadatos del pod (en producción no resuelve hasta tenerlos).
 * @param construir - Compone el contexto a partir de ellos.
 */
export function resolverContexto(metadatos: Promise<IMetadatosPod>, construir: (metadatos: IMetadatosPod) => IContextoHeartbeat): Promise<IContextoHeartbeat> {
    return metadatos
        .then((datos) => {
            info(`Heartbeat: cluster="${datos.cluster.valor}" (${datos.cluster.origen}), proyecto="${datos.proyecto.valor}" (${datos.proyecto.origen}), ubicación="${datos.ubicacion.valor}" (${datos.ubicacion.origen})`);

            return construir(datos);
        })
        .catch((err: unknown) => {
            warning("Heartbeat: no se pudo construir el contexto; este pod no emitirá", err);

            return new Deferred<IContextoHeartbeat>().promise;
        });
}
