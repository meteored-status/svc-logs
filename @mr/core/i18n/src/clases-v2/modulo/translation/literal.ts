/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 28 Sep 2026 06:38:15 GMT
 * Hash: 70f62a4fe1565b56863dfc5f953f27f2
 * Versión: 2026.9.28+1-juancmartinez
 * Anterior: 2026.9.23+1-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-panel-frontend.git
 */

import type {JSONItem, JSONValue} from "../../data";
import type {Definition} from "../definition";
import {type IEntradaEmitida, LANG_REGEXPS} from "./common";
import {emitirValor} from "./valor";
import type {ModuloJSON} from "../json";
import {pascalCase} from "../../util/case";

/**
 * Una entrada con **un** valor, envuelto en un `Literal`.
 *
 * Sin sufijo en los nombres de las variables, que aquí no hay más que uno; lo que declara el valor es
 * `emitirValor()`, compartido con `map.ts` y `set.ts`.
 */
export default (lang: string, value: JSONValue, item: JSONItem, module: ModuloJSON, definition: Definition): IEntradaEmitida => {

    const langMatch = LANG_REGEXPS.find(({regex}) => regex.test(lang));
    const langKey = langMatch ? langMatch.lang : lang;

    const paramDefinition = pascalCase(`${item.id}Params`);
    const conParams = (item.params ?? []).length > 0;

    const emitido = emitirValor(value, item, module, definition, langKey, "");

    const imports: string[] = [`import {Literal} from "@mr/core-i18n/literal";`, ...emitido.imports];
    const lineas: string[] = [...emitido.lineas];

    if (conParams) {
        lineas.push(`const literal = new Literal<${paramDefinition}>(${emitido.variable});`);
        return {imports, lineas, expresion: `(params: Partial<${paramDefinition}>) => literal.render(params)`};
    }

    lineas.push(`const literal = new Literal(${emitido.variable});`);
    return {imports, lineas, expresion: `literal.render()`};
}
