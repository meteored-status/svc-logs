/**
 * Editor: Fran García
 * Fecha: Fri, 19 Jun 2026 07:29:05 GMT
 * Hash: 1097c2a6f48381c7ed9e379e1bd47220
 * Versión: 2026.6.19+1-frangarcia
 */

//Funcion para parsear el idioma cuando venga en formato largo con numeros
import type {Idioma, IdiomaCorto} from "@mr/core-i18n/langs";

export function parseIdioma(idioma: string): Idioma {
    if(idioma.match(/[a-z]{2}_[0-9]+$/) || idioma.match(/[a-z]{2}-[0-9]+$/)){
        return idioma.substring(0, 2) as IdiomaCorto;
    }
    return idioma as Idioma;
}

const RTL_LANGS: string[] = ["ar", "fa", "he", "ur"];

export const isRTL = (idioma: string): boolean => {
    const idiomaCorto = parseIdioma(idioma);
    return RTL_LANGS.includes(idiomaCorto);
}
