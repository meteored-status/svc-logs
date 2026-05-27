//Funcion para parsear el idioma cuando venga en formato largo con numeros
import type {Idioma, IdiomaCorto} from "../net/i18n";

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
