/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 94231d7d2ef22196fe6646b453b013e0
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

// El `TParams` de casa (`./value/value`) y no el de `services-comun/modules/traduccion` (v1).
// Son el mismo tipo —`Record<string, string|number>`, definido dos veces— pero apuntar al de v1
// ataba este runtime al del generador anterior sin ninguna razón, y con el traslado a
// `@mr/core-i18n` habría sido una dependencia entre paquetes.
import type {TParams} from "./value/value";

export abstract class Translation<T extends TParams={}> {
    /* INSTANCE */
}
