/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 10:14:46 GMT
 * Hash: ef327a6cf9ab32ab14f4d2c4f54d625a
 */

/**
 * Código ISO 639-1 de dos letras para los idiomas soportados.
 * Representa el subconjunto corto usado internamente para agrupar variantes regionales.
 */
export type IdiomaCorto = "ar" | "bn" | "ca" | "cs" | "da" | "de" | "el" | "en" | "es" | "eu" | "fa" | "fi" | "fil" | "fr" | "gl" | "he" | "hi" | "hr" | "hu" | "id" | "it" | "ja" | "ko" | "ms" | "my" | "nb" | "nl" | "no" | "pl" | "pt" | "ro" | "ru" | "sk" | "sv" | "sw" | "th" | "tl" | "tr" | "ur" | "vi";

/**
 * Código de idioma largo con variante regional (formato BCP 47: `idioma-REGIÓN`).
 * Se usa cuando el servicio necesita distinguir entre variantes del mismo idioma
 * (p. ej. português de Portugal vs. Brasil).
 */
export type IdiomaLargo =
    | "de-DE" | "de-AT"
    | "da-DK"
    | "en-US" | "en-GB" | "en-CA"
    | "es-ES" | "es-AR" | "es-MX" | "es-CL" | "es-BO" | "es-CR" | "es-DO" | "es-EC" | "es-HN" | "es-PA" | "es-PE" | "es-PY" | "es-UY" | "es-VE"
    | "fr-FR"
    | "it-IT"
    | "nl-NL"
    | "pt-PT" | "pt-BR"
    | "ru-RU";

/**
 * Código de idioma soportado por el sistema: corto (`"es"`) o largo (`"es-ES"`).
 */
export type Idioma = IdiomaCorto | IdiomaLargo;

/**
 * Lista completa de todos los idiomas (cortos y largos) soportados por el sistema.
 * Se usa para validar el segmento de idioma en el path de las URLs.
 */
export const soportados: Idioma[] = [
    "ar", "bn", "ca", "cs", "da", "de", "el", "en", "es", "eu", "fa", "fi", "fil", "fr", "gl", "he", "hi", "hr", "hu", "id", "it", "ja", "ko", "ms", "my", "nb", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sv", "sw", "th", "tl", "tr", "ur", "vi",
    "da-DK",
    "de-AT", "de-DE",
    "en-CA", "en-GB", "en-US",
    "es-AR", "es-BO", "es-CL", "es-CR", "es-DO", "es-EC", "es-ES", "es-HN", "es-MX", "es-PA", "es-PE", "es-PY", "es-UY", "es-VE",
    "fr-FR",
    "it-IT",
    "nl-NL",
    "pt-PT", "pt-BR",
    "ru-RU",
];

/**
 * Comprueba si un código de idioma pertenece a la lista de idiomas soportados.
 * @param lang - Código de idioma a validar.
 * @returns `true` si el idioma está soportado.
 */
export const soportado = (lang: Idioma): boolean => soportados.includes(lang);

/**
 * Extrae el código corto ISO 639-1 de un idioma (los dos primeros caracteres).
 * @param idioma - Código de idioma largo o corto (p. ej. `"es-ES"` → `"es"`).
 * @returns Código corto de dos letras.
 */
export const corto = (idioma: Idioma): IdiomaCorto => idioma.slice(0, 2) as IdiomaCorto;

