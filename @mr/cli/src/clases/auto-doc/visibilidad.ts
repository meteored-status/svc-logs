/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 12 Nov 2026 11:55:33 GMT
 * Hash: 16538dbbc07318523f0595cf0e04be23
 * Versión: 2026.11.12+1-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-intranet.git
 */

import type {IOperacionRuta} from "./modelo";

/**
 * `true` si la operación es privada: `internal: true` (sale con `x-internal`) o su path es `/private` o cuelga de él
 * (`/private/...`). Es el criterio con el que doc-backend separa el alcance `public` (`esInterna` de
 * `doc-base/modules/intranet/clasificar.ts`, en meteored-svc-doc): si cambia allí, hay que cambiarlo aquí.
 *
 * @param operacion - Operación a clasificar.
 */
export function esPrivada(operacion: Pick<IOperacionRuta, "internal" | "path">): boolean {
    return operacion.internal || operacion.path === "/private" || operacion.path.startsWith("/private/");
}

/**
 * Orden en el que se reparten los nombres (de esquema y `operationId`): las públicas antes que las privadas y, dentro de
 * cada lado, por path y método. Así lo que se queda el nombre limpio en el documento público solo depende de las
 * operaciones públicas: ni de las privadas ni del orden en que TypeScript descubre los ficheros.
 *
 * @param a - Operación.
 * @param b - Operación.
 */
export function compararParaNombres(a: IOperacionRuta, b: IOperacionRuta): number {
    const privadaA = esPrivada(a);
    if (privadaA !== esPrivada(b)) {
        return privadaA ? 1 : -1;
    }
    const x = `${a.path} ${a.metodo}`;
    const y = `${b.path} ${b.metodo}`;

    return x < y ? -1 : x > y ? 1 : 0;
}
