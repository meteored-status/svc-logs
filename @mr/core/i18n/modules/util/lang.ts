/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 29 Sep 2026 11:00:55 GMT
 * Hash: 73b72413f9437bd931e7bb9bf7d0797b
 * Versión: 2026.9.29+1-juancmartinez
 * Anterior: 2026.9.17+2-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-cmp.git
 */

/**
 * El código de idioma tal y como se escribe en disco: el mismo tag, sin los separadores de subtag.
 *
 * Vive aquí, y no repetido en el generador, porque el nombre del directorio lo **escribe** `mrlang` y lo
 * **busca** `getLang()`: son los dos extremos de la misma convención. Mientras fueron dos líneas distintas
 * no decían lo mismo — la del generador era `replace("-", "")`, que en JS sustituye solo la **primera**
 * ocurrencia, así que con dos subtags acertaba por casualidad y con tres no: `ca-ES-valencia` se escribía en
 * `caES-valencia` y se buscaba en `caESvalencia`. Y no daba error de nada: `getLang()` no lo encontraba y
 * caía al inglés, con la pantalla entera traducida menos ese módulo.
 *
 * @param lang - Código de idioma, con `-` o `_` entre subtags.
 * @returns El código sin separadores (`ca-ES-valencia` → `caESvalencia`).
 */
export const flattenLang = (lang: string): string => lang.replace(/[-_]/g, "");

/**
 * La cadena de búsqueda de un idioma, de más específico a menos: el propio código y lo que va quedando al
 * quitarle subtags por la derecha — `ca-ES-valencia` → `ca-ES` → `ca`.
 *
 * Es el algoritmo *Lookup* de RFC 4647 §3.4, que es como BCP 47 dice que se busca una traducción: el
 * catálogo de idiomas de `mrlang` declara la herencia a mano (`es-ES` → `es` → `en` → `en-US`) y eso vale
 * para los códigos que alguien dio de alta, pero un tag cualquiera no está en ninguna lista. Truncar por la
 * derecha es lo que convierte un código que nadie ha declarado en algo que se puede resolver.
 *
 * El subtag de una sola letra se quita junto con el que lo sigue —`de-DE-u-co-phonebk` → `de-DE-u-co` →
 * `de-DE`— porque abre una extensión y por sí solo no nombra ningún idioma. Lo dice la propia RFC y sale
 * gratis ponerlo.
 *
 * @param lang - Código de idioma, con `-` o `_` entre subtags.
 * @returns Los códigos a probar, empezando por el pedido. Nunca vacío para una entrada no vacía.
 */
export const langChain = (lang: string): string[] => {
    const subtags = lang.split(/[-_]/).filter((subtag) => subtag.length > 0);
    const salida: string[] = [];

    while (subtags.length > 0) {
        salida.push(subtags.join("-"));
        subtags.pop();
        if ((subtags[subtags.length - 1]?.length ?? 0) == 1) {
            subtags.pop();
        }
    }

    return salida;
};

/**
 * El idioma disponible que corresponde a uno pedido, o `undefined` si no está.
 *
 * Se prueba la **cadena entera** del idioma pedido, no solo el código exacto: un módulo que está en `ca` y
 * no en `ca-ES-valencia` sirve al valenciano, que es lo que cualquiera espera y lo que antes no pasaba —sin
 * acierto exacto se caía al defecto del módulo, o al inglés—. Un módulo que sí tenga la variante la sigue
 * ganando, porque la cadena va de más específico a menos.
 *
 * La comparación **ignora las mayúsculas** porque BCP 47 dice que los tags son insensibles a ellas:
 * `ca-ES-valencia` y `ca-es-VALENCIA` son el mismo idioma, y de un `Accept-Language` o de un
 * `navigator.language` llega lo que llega. Lo que se devuelve es la entrada de `availableLangs`, no lo
 * buscado: es un nombre de directorio y tiene que salir con la caja con la que se escribió.
 *
 * @param availableLangs - Idiomas del módulo, ya aplanados.
 * @param lang           - Idioma pedido.
 */
const buscarLang = (availableLangs: string[], lang: string): string|undefined => {
    for (const candidato of langChain(lang)) {
        const buscado = flattenLang(candidato).toLowerCase();
        const encontrado = availableLangs.find((disponible) => disponible.toLowerCase() == buscado);
        if (encontrado != undefined) {
            return encontrado;
        }
    }

    return undefined;
};

export const getLang = (availableLangs: string[], lang: string, defaultLang?: string): string => {
    const encontrado = buscarLang(availableLangs, lang) ?? (defaultLang != undefined ? buscarLang(availableLangs, defaultLang) : undefined);

    return encontrado ?? "enUS";
};
