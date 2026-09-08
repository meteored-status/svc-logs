/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 6c8978258ed2bb6eeafe6c73205ab806
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.9.2+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {JSONItem, JSONValorSet} from "../../data";
import {Definition} from "../definition";
import {LANG_REGEXPS} from "./common";
import {emitirValor} from "./valor";
import {ModuloJSON} from "../json";
import {pascalCase} from "../../util/case.ts";

/**
 * Un fichero con **varios** valores ordenados, envueltos en un `TranslationSet`.
 *
 * Mismo cuerpo que `map.ts` salvo en qué los envuelve y en que aquí no hay claves: lo que declara cada valor
 * es `emitirValor()`, compartido con los otros dos.
 */
export default (lang: string, value: JSONValorSet, item: JSONItem, module: ModuloJSON, definition: Definition) => {

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

    const fileLines: string[] = [];

    fileLines.push('// NO EDITAR A MANO');
    fileLines.push('');
    fileLines.push(...imports.values());
    fileLines.push('');

    valuesLines.forEach(valueLines => {
        fileLines.push(...valueLines);
        fileLines.push('');
    });
    fileLines.push('');

    let declarationLine = `const translationSet = new TranslationSet`;

    if ((item.params ?? []).length > 0) {
        declarationLine += `<${paramDefinition}>`;
    }
    declarationLine += '(';

    fileLines.push(`${declarationLine}[`);
    fileLines.push(`${values.map(v => `    ${v}`).join(',\n')}`);
    fileLines.push(`]);`);

    fileLines.push('');
    fileLines.push(`export default translationSet;`);

    return fileLines.join('\n');

}
