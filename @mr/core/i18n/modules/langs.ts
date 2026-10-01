/**
 * Editor: miguel
 * Fecha: Thu, 24 Sep 2026 12:33:20 GMT
 * Hash: c70357f8b79c06a95e4a5da159618869
 * Versión: 2026.9.24+2-miguel
 * Anterior: 2026.9.24+1-miguel
 * Proyecto: https://github.com/alpred/meteored-web-www.git
 */

/**
 * La **subetiqueta primaria** BCP 47 de los idiomas soportados: lo que hay hasta el primer separador.
 *
 * Casi todos son los dos caracteres de ISO 639-1, pero no todos —`"fil"` tiene tres—, así que la longitud
 * no es fija y no hay que apoyarse en ella. `corto()` corta por el separador justamente por eso.
 */
export type IdiomaCorto =
    | "ar" | "az" | "bg" | "bn"
    | "bs" | "ca" | "cs" | "da"
    | "de" | "el" | "en" | "es"
    | "eu" | "fa" | "fi" | "fil"
    | "fr" | "gl" | "he" | "hi"
    | "hr" | "hu" | "id" | "it"
    | "ja" | "ka" | "km" | "ko"
    | "ky" | "lo" | "mk" | "mn"
    | "ms" | "my" | "nb" | "ne"
    | "nl" | "no" | "pl" | "pt"
    | "ro" | "ru" | "sk" | "sq"
    | "sr" | "sv" | "sw" | "tg"
    | "th" | "tl" | "tr" | "uk"
    | "ur" | "uz" | "vi";

/**
 * Código de idioma con variante (BCP 47: `idioma-REGIÓN`, y en general subetiqueta primaria más lo que
 * venga detrás). Se usa cuando el servicio necesita distinguir entre variantes del mismo idioma
 * —português de Portugal vs. Brasil—, o entre normas de una misma lengua: `ca-ES-valencia`.
 *
 * **No es «el código completo»**, que es `Idioma`: aquí solo están los que llevan variante. La lista es
 * cerrada a propósito —lista blanca de lo que se mantiene, no de lo que BCP 47 permite escribir—, así que
 * un idioma nuevo se da de alta aquí y en `soportados`, y nada más.
 */
export type IdiomaLargo =
    | "de-DE" | "de-AT"
    | "da-DK"
    | "en-US" | "en-GB" | "en-CA" | "en-AU"
    | "es-ES" | "es-AR" | "es-MX" | "es-CL" | "es-BO" | "es-CR" | "es-DO" | "es-EC" | "es-HN" | "es-PA" | "es-PE"
    | "es-PY" | "es-UY" | "es-VE" | "es-419"
    | "fr-FR"
    | "it-IT"
    | "nl-NL"
    | "pt-PT" | "pt-BR"
    | "ru-RU"
    | "sr-Cyrl";

/**
 * Código de idioma soportado por el sistema: corto (`"es"`) o largo (`"es-ES"`).
 */
export type Idioma = IdiomaCorto | IdiomaLargo;

/**
 * Lista completa de todos los idiomas (cortos y largos) soportados por el sistema.
 * Se usa para validar el segmento de idioma en el path de las URLs.
 */
export const soportados: Idioma[] = [
    // Idiomas cortos
    "ar", "az", "bg", "bn", "bs", "ca", "cs", "da", "de", "el", "en", "es", "eu",
    "fa", "fi", "fil", "fr", "gl", "he", "hi", "hr", "hu", "id", "it", "ja", "ka",
    "km", "ko", "ky", "lo", "mk", "mn", "ms", "my", "nb", "ne", "nl", "no", "pl",
    "pt", "ro", "ru", "sk", "sq", "sr", "sv", "sw", "tg", "th", "tl", "tr", "uk",
    "ur", "uz", "vi",

    // Idiomas largos (variantes)
    "de-DE", "de-AT", "da-DK",
    "en-US", "en-GB", "en-CA", "en-AU",
    "es-ES", "es-AR", "es-MX", "es-CL", "es-BO", "es-CR", "es-DO", "es-EC", "es-HN",
    "es-PA", "es-PE", "es-PY", "es-UY", "es-VE", "es-419",
    "fr-FR",
    "it-IT",
    "nl-NL",
    "pt-PT", "pt-BR",
    "ru-RU",
    "sr-Cyrl"
];

/**
 * Comprueba si una cadena cualquiera es uno de los idiomas soportados.
 *
 * Es una **guarda de tipo**, que es lo que hace usable una lista blanca cerrada: se valida en el borde
 * —el handler, el segmento de la URL, lo que venga de un `Accept-Language`— y a partir de ahí se trabaja
 * con `Idioma` sin volver a comprobarlo. Antes recibía `Idioma`, así que para preguntarle por una cadena
 * cualquiera —el único caso interesante— había que hacerle un cast delante, y el cast es exactamente lo
 * que la pregunta pretendía evitar.
 *
 * @param lang - Lo que haya llegado.
 */
export const soportado = (lang: string): lang is Idioma => (soportados as readonly string[]).includes(lang);

/**
 * La subetiqueta primaria de un idioma: lo que hay hasta el primer separador.
 *
 * **Corta por el separador y no por los dos primeros caracteres**, que es lo que hacía antes. Con
 * `slice(0, 2)`, `"fil"` se convertía en `"fi"` —finés—, y lo peor era que `"fi"` también está soportado:
 * no lanzaba, no devolvía `undefined` y el tipo seguía siendo `IdiomaCorto`, así que nada aguas abajo
 * podía detectar el cambiazo. Con códigos de tres letras, de escritura (`sr-Cyrl`) o de región numérica
 * (`es-419`) el recorte fijo es sencillamente otra cosa.
 *
 * @param idioma - Código de idioma, con o sin variante (`"es-ES"` → `"es"`, `"fil"` → `"fil"`).
 * @returns La subetiqueta primaria.
 */
export const corto = (idioma: Idioma): IdiomaCorto => idioma.split(/[-_]/)[0] as IdiomaCorto;

