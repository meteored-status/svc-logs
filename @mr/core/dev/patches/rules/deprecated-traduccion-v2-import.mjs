import {createSimpleRule} from "../rule-factory.mjs";

/**
 * El runtime de traducciones v2 se mudó de `services-comun` a `@mr/core-i18n`, que es donde ya
 * vivían los tipos de idioma y el generador que produce el código que lo consume.
 *
 * Una sola regla cubre las ocho rutas porque el traslado conserva la estructura por debajo del
 * prefijo: `.../traduccion/v2/value/singular-value` → `@mr/core-i18n/value/singular-value`, y así
 * todas. Por eso basta sustituir el prefijo, y por eso no hace falta ordenar subpaths antes que
 * padres como en otras reglas: no hay match parcial que evitar.
 *
 * La barra final del `source` es deliberada. Sin ella también capturaría
 * `services-comun/modules/traduccion/v2` a secas —el `index.ts`, con la clase base `Translation`—,
 * que **no** se exporta desde `@mr/core-i18n`: es interno del paquete y nadie lo importaba de
 * fuera. Si alguna vez apareciera un import así, es mejor que falle a que lo reescriba a una ruta
 * que no resuelve.
 */
export const deprecatedTraduccionV2ImportRule = createSimpleRule({
    id: "R035-deprecated-traduccion-v2-import",
    summary: "services-comun/modules/traduccion/v2/* -> @mr/core-i18n/*",
    source: "services-comun/modules/traduccion/v2/",
    target: "@mr/core-i18n/",
});
