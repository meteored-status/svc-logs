/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 28 Sep 2026 06:38:15 GMT
 * Hash: 912eb4ae689b12f79396039f242b9013
 * Versión: 2026.9.28+1-juancmartinez
 * Anterior: 2026.9.23+1-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-panel-frontend.git
 */

import type {JSONItem, JSONValorMap} from "../../data";
import type {Definition} from "../definition";
import {definitionModulePath, type IEntradaEmitida, LANG_REGEXPS} from "./common";
import {emitirValor} from "./valor";
import {pascalCase} from "../../util/case";
import type {ModuloJSON} from "../json";

/**
 * Una entrada con **varios** valores indexados por clave, envueltos en un `TranslationMap`.
 *
 * Los `params` son de la entrada entera y no de cada valor, así que todos los de un mapa comparten la misma
 * lista y el mismo `counter` — que es lo que permite tener «{{n}} alta / {{n}} altas» por severidad en una
 * sola entrada.
 */
export default (lang: string, value: JSONValorMap, item: JSONItem, module: ModuloJSON, definition: Definition): IEntradaEmitida => {

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

    const lineas: string[] = [];

    Object.values(valuesLines).forEach(valueLines => {
        lineas.push(...valueLines);
        lineas.push('');
    });

    let declarationLine = `const translationMap = new TranslationMap<${keysDefinition}Keys`;

    if ((item.params ?? []).length > 0) {
        declarationLine += `, ${paramDefinition}`;
    }
    declarationLine += '>({';

    lineas.push(declarationLine);
    Object.entries(keys).forEach(([key, value]) => {
        lineas.push(`    "${key}": ${value},`);
    });
    lineas.push(`});`);

    return {imports: Array.from(imports.values()), lineas, expresion: `translationMap`};

}
