/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: bddf0da1ff7744d1f6332a618a2f1337
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.9.2+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {JSONItem, JSONValorMap} from "../../data";
import {Definition} from "../definition";
import {definitionModulePath, LANG_REGEXPS} from "./common";
import {emitirValor} from "./valor";
import {pascalCase} from "../../util/case";
import {ModuloJSON} from "../json";

/**
 * Un fichero con **varios** valores indexados por clave, envueltos en un `TranslationMap`.
 *
 * Los `params` son de la entrada entera y no de cada valor, así que todos los de un mapa comparten la misma
 * lista y el mismo `counter` — que es lo que permite tener «{{n}} alta / {{n}} altas» por severidad en una
 * sola entrada.
 */
export default (lang: string, value: JSONValorMap, item: JSONItem, module: ModuloJSON, definition: Definition) => {

    const langMatch = LANG_REGEXPS.find(({regex}) => regex.test(lang));
    const langKey = langMatch ? langMatch.lang : lang;

    const imports: Set<string> = new Set();
    const valuesLines: Record<string, string[]> = {};

    const paramDefinition = pascalCase(`${item.id}Params`);
    const keysDefinition = pascalCase(`${item.id}`);

    imports.add(`import {TranslationMap} from "@mr/core-i18n/translation-map";`);
    imports.add(`import type {${keysDefinition}Keys} from "${definitionModulePath(module)}";`);

    const keys: Record<string, string> = {};

    let valueCount: number = 1;
    Object.entries(value.valores).forEach(([key, valor]) => {
        definition.addRecordDefinitionEntry(keysDefinition, key);

        const emitido = emitirValor(valor, item, module, definition, langKey, `${valueCount}`);
        emitido.imports.forEach(linea => imports.add(linea));
        (valuesLines[key] ??= []).push(...emitido.lineas);
        keys[key] = emitido.variable;

        valueCount++;
    });

    const fileLines: string[] = [];

    fileLines.push('// NO EDITAR A MANO');
    fileLines.push('');
    fileLines.push(...imports.values());
    fileLines.push('');

    Object.values(valuesLines).forEach(valueLines => {
        fileLines.push(...valueLines);
        fileLines.push('');
    });
    fileLines.push('');

    let declarationLine = `const translationMap = new TranslationMap<${keysDefinition}Keys`;

    if ((item.params ?? []).length > 0) {
        declarationLine += `, ${paramDefinition}`;
    }
    declarationLine += '>({';

    fileLines.push(declarationLine);
    Object.entries(keys).forEach(([key, value]) => {
        fileLines.push(`    "${key}": ${value},`);
    });
    fileLines.push(`});`);

    fileLines.push('');
    fileLines.push(`export default translationMap;`)

    return fileLines.join('\n');

}
