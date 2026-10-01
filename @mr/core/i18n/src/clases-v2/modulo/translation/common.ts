/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 28 Sep 2026 06:38:15 GMT
 * Hash: 988ef2e12cc02e381945e442416aefdf
 * Versión: 2026.9.28+1-juancmartinez
 * Anterior: 2026.9.23+1-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-panel-frontend.git
 */

import type {ModuloJSON} from "../json";

/**
 * Lo que emite un emisor de entrada (`literal.ts`, `map.ts`, `set.ts`): no ya el fichero entero, sino los
 * trozos que `generateLangIndex()` (en `modulo/json.ts`) coloca dentro del `index.ts` del módulo — una
 * entrada por cada una, en su propia IIFE, para que las variables internas (`value`, `literal`,
 * `translationMap`…) no colisionen entre entradas del mismo módulo.
 *
 * @property imports   - Las líneas de import que necesitan `lineas` y `expresion`. Quien las junta con las
 *                       de las demás entradas lo hace en un `Set`, para no repetir la misma línea.
 * @property lineas    - Las declaraciones de la entrada, en orden, sin la cabecera `// NO EDITAR A MANO` ni
 *                       el `export default`: van dentro del cuerpo de la IIFE, indentadas por quien las usa.
 * @property expresion - Lo que antes iba detrás de `export default`: `literal.render()`, una función que lo
 *                       envuelve cuando la entrada tiene `params`, o el `translationMap`/`translationSet` ya
 *                       construido. Es el `return` de la IIFE.
 */
export interface IEntradaEmitida {
    imports: string[];
    lineas: string[];
    expresion: string;
}

export const LANG_REGEXPS = [
    {
        regex: /^es-([A-Z\d]{2,3})$/i,
        lang: 'es'
    },
    {
        regex: /^en-([A-Z\d]{2,3})$/i,
        lang: 'en'
    },
    {
        // Anclada **entera**: `/^pt-PT|pt$/` se lee como `(^pt-PT)|(pt$)`, porque la alternancia es lo que
        // menos ata, así que casaba cualquier código *terminado* en «pt» —`egypt`, `apt`— y dejaba fuera lo
        // que se pretendía. Con los idiomas de hoy no se notaba; se notaría al añadir uno.
        //
        // `pt-PT` y no `pt_PT`: lo que sale de aquí se emite tal cual como `pluralBuilder('<lang>')`, o sea
        // que acaba en un `new Intl.PluralRules()`, y con el guion bajo no es un tag válido — reventaba, y
        // el `catch` de `plural-function-builder` lo dejaba en **reglas inglesas**. Se veía a partir del
        // millón: `pt-PT` tiene categoría `many` y el inglés no, así que una forma `many` escrita por un
        // traductor no se usaba nunca. El nombre CLDR del juego de reglas sí lleva guion bajo (`pt_PT`), y
        // de ahí venía la confusión; el **locale** que hay que pedirle a `Intl` lleva guion.
        regex: /^(pt-PT|pt)$/i,
        lang: 'pt-PT'
    },
    {
        regex: /^pt-BR$/i,
        lang: 'pt'
    }
];

export const definitionModulePath = (module: ModuloJSON) => {
    const dirs = module.path().split('/');
    const subDirsCount = dirs.length + 2; // +2 for the <lang> directory and /langs directory
    return `${"../".repeat(subDirsCount)}definitions${module.path()}/${module.name()}`;
}

export const langModulePath = (modulePath: string, moduleName: string, lang: string): string => {
    const dirs = modulePath.split('/');
    const subDirsCount = dirs.length + 1; // + for the /langs directory
    return `${"../".repeat(subDirsCount)}langs/${lang}${modulePath}/${moduleName}`;
}
