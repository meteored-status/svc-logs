export type IdiomaCorto= "ca" | "cs" | "da" | "de" | "en" | "es" | "eu" | "fi" | "fr" | "gl" | "hi" | "hu" | "it" | "nl" | "no" | "pl" | "pt" | "ro" | "ru" | "sk" | "sv" | "tr" | "bn" | "tl" | "el" | "id" | "ja" | "ko" | "ms" | "my" | "nb" | "sw" | "th" | "vi" | "hr" | "fil" | "he" | "fa" | "ur" | "ar";

export type IdiomaLargo =
    | "de-DE" | "de-AT"
    | "en-US" | "en-GB" | "en-CA"
    | "es-ES" | "es-AR" | "es-MX" | "es-CL" | "es-BO" | "es-CR" | "es-DO" | "es-EC" | "es-HN" | "es-PA" | "es-PE" | "es-PY" | "es-UY" | "es-VE"
    | "fr-FR"
    | "it-IT"
    | "nl-NL"
    | "pt-PT" | "pt-BR"
    | "ru-RU";
    

export type Idioma = IdiomaCorto | IdiomaLargo;

export const soportados: Idioma[] = [
    "ca", "cs", "da", "de", "en", "es", "eu", "fi", "fr", "gl", "hi", "hu", "it", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sv", "tr",
    "de-DE", "de-AT",
    "en-US", "en-GB", "en-CA",
    "es-ES", "es-AR", "es-MX", "es-CL", "es-BO", "es-CR", "es-DO", "es-EC", "es-HN", "es-PA", "es-PE", "es-PY", "es-UY", "es-VE",
    "fr-FR",
    "it-IT",
    "nl-NL",
    "pt-PT", "pt-BR",
    "ru-RU",
];

export const soportado = (lang: Idioma): boolean => soportados.indexOf(lang)>=0;
