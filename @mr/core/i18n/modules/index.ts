/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 016b7d32b494c423e6546a2883bb3f39
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.6.17+7-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

// El `TParams` de casa (`./value/value`) y no el de `services-comun/modules/traduccion` (v1).
// Son el mismo tipo —`Record<string, string|number>`, definido dos veces— pero apuntar al de v1
// ataba este runtime al del generador anterior sin ninguna razón, y con el traslado a
// `@mr/core-i18n` habría sido una dependencia entre paquetes.
import type {TParams} from "./value/value";

export abstract class Translation<T extends TParams={}> {
    /* STATIC */

    /* INSTANCE */
}
