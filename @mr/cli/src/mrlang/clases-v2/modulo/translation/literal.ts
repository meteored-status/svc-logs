/**
 * Editor: Bixus
 * Fecha: Wed, 02 Sep 2026 14:55:52 GMT
 * Hash: 4d64376985f4c15e5e8b28740e21becf
 * Versión: 2026.9.2+3-bixus
 * Anterior: 2026.9.2+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {JSONItem, JSONValue} from "../../data";
import {Definition} from "../definition";
import {LANG_REGEXPS} from "./common";
import {emitirValor} from "./valor";
import {ModuloJSON} from "../json";
import {pascalCase} from "../../util/case.ts";

/**
 * Un fichero con **un** valor, envuelto en un `Literal`.
 *
 * Sin sufijo en los nombres de las variables, que aquí no hay más que uno; lo que declara el valor es
 * `emitirValor()`, compartido con `map.ts` y `set.ts`.
 */
export default (lang: string, value: JSONValue, item: JSONItem, module: ModuloJSON, definition: Definition) => {

    const langMatch = LANG_REGEXPS.find(({regex}) => regex.test(lang));
    const langKey = langMatch ? langMatch.lang : lang;

    const paramDefinition = pascalCase(`${item.id}Params`);
    const conParams = (item.params ?? []).length > 0;

    const emitido = emitirValor(value, item, module, definition, langKey, "");

    const fileLines: string[] = [];

    fileLines.push('// NO EDITAR A MANO');
    fileLines.push('');
    fileLines.push(`import {Literal} from "services-comun/modules/traduccion/v2/literal";`);
    fileLines.push(...emitido.imports);
    fileLines.push('');
    fileLines.push(...emitido.lineas);
    fileLines.push('');

    if (conParams) {
        fileLines.push(`const literal = new Literal<${paramDefinition}>(${emitido.variable});`);
        fileLines.push(`export default (params: Partial<${paramDefinition}>) => literal.render(params);`);
    } else {
        fileLines.push(`const literal = new Literal(${emitido.variable});`);
        fileLines.push(`export default literal.render();`);
    }

    return fileLines.join('\n');
}
