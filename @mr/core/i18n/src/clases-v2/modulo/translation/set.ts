/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 28 Sep 2026 06:38:15 GMT
 * Hash: 0fb7b75ff5db5a2d7df4511b728e4932
 * Versión: 2026.9.28+1-juancmartinez
 * Anterior: 2026.9.23+1-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-panel-frontend.git
 */

import type {JSONItem, JSONValorSet} from "../../data";
import type {Definition} from "../definition";
import {type IEntradaEmitida, LANG_REGEXPS} from "./common";
import {emitirValor} from "./valor";
import type {ModuloJSON} from "../json";
import {pascalCase} from "../../util/case";

/**
 * Una entrada con **varios** valores ordenados, envueltos en un `TranslationSet`.
 *
 * Mismo cuerpo que `map.ts` salvo en qué los envuelve y en que aquí no hay claves: lo que declara cada valor
 * es `emitirValor()`, compartido con los otros dos.
 */
export default (lang: string, value: JSONValorSet, item: JSONItem, module: ModuloJSON, definition: Definition): IEntradaEmitida => {

    const langMatch = LANG_REGEXPS.find(({regex}) => regex.test(lang));
    const langKey = langMatch ? langMatch.lang : lang;

    const imports: Set<string> = new Set();
    const valuesLines: string[][] = [];

    const paramDefinition = pascalCase(`${item.id}Params`);

    const values: string[] = [];

    imports.add(`import {TranslationSet} from "@mr/core-i18n/translation-set";`);

    let valueCount: number = 1;
    value.valores.forEach((valor) => {
        const emitido = emitirValor(valor, item, module, definition, langKey, `${valueCount}`);
        emitido.imports.forEach(linea => imports.add(linea));
        valuesLines.push(emitido.lineas);
        values.push(emitido.variable);

        valueCount++;
    });

    const lineas: string[] = [];

    valuesLines.forEach(valueLines => {
        lineas.push(...valueLines);
        lineas.push('');
    });

    let declarationLine = `const translationSet = new TranslationSet`;

    if ((item.params ?? []).length > 0) {
        declarationLine += `<${paramDefinition}>`;
    }
    declarationLine += '(';

    lineas.push(`${declarationLine}[`);
    values.forEach(v => lineas.push(`    ${v},`));
    lineas.push(`]);`);

    return {imports: Array.from(imports.values()), lineas, expresion: `translationSet`};

}
