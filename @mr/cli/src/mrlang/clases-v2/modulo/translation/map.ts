import {JSONItem, JSONValorMap, JSONValuePlural, JSONValueSingular} from "../../data";
import {Definition} from "../definition";
import {definitionModulePath, LANG_REGEXPS} from "./common";
import {pascalCase} from "../../util/case";
import {ModuloJSON} from "../json";

export default (lang: string, value: JSONValorMap, item: JSONItem, module: ModuloJSON, definition: Definition) => {

    const langMatch = LANG_REGEXPS.find(({regex}) => regex.test(lang));
    const langKey = langMatch ? langMatch.lang : lang;

    const imports: Set<string> = new Set();
    const valuesLines: Record<string, string[]> = {};

    const paramDefinition = pascalCase(`${item.id}Params`);
    const keysDefinition = pascalCase(`${item.id}`);

    imports.add(`import {MapExport, TranslationMap} from "services-comun/modules/traduccion/v2/translation-map";`);
    imports.add(`import type {${keysDefinition}Record} from "${definitionModulePath(module)}";`);

    const keys: Record<string, string> = {};

    let valueCount: number = 1;
    Object.entries(value.valores).forEach(([key, value]) => {
        definition.addRecordDefinitionEntry(keysDefinition, key);

        switch (value.type) {
            case "singular":
                const singularValue = value as JSONValueSingular;
                imports.add(`import {SingularValue} from "services-comun/modules/traduccion/v2/value/singular-value";`);
                if (item.params && item.params.length > 0) {
                    imports.add(`import type {${paramDefinition}} from "${definitionModulePath(module)}";`);
                }

                const block = valuesLines[key]??=[];

                block.push(`const value${valueCount} = \`${singularValue.value}\`;`);

                if (item.params && item.params.length > 0) {
                    block.push(`const singularValue${valueCount} = new SingularValue<${paramDefinition}>(value${valueCount});`);
                    definition.addParamDefinition(paramDefinition, item.params);
                } else {
                    block.push(`const singularValue${valueCount} = new SingularValue(value${valueCount});`);
                }
                keys[key] = `singularValue${valueCount}`;
                break;
            case "plural":
                const pluralValue = value as JSONValuePlural;
                imports.add(`import {${langKey}} from "make-plural/cardinals";`)
                imports.add(`import {PluralValue} from "services-comun/modules/traduccion/v2/value/plural-value";`);
                imports.add(`import {TPluralKey} from "services-comun/modules/traduccion/v2/value";`);
                if (item.params && item.params.length > 0) {
                    imports.add(`import type {${paramDefinition}} from "${definitionModulePath(module)}";`);
                }

                const block2 = valuesLines[key]??=[];

                block2.push(`const values${valueCount}: Partial<Record<TPluralKey, string>> = {`);
                Object.entries(pluralValue.value).forEach(([key, value]) => {
                    block2.push(`    ${key}: "${value}",`);
                });
                block2.push('};');

                if (item.params && item.params.length > 0) {
                    block2.push(`const pluralValue${valueCount} = new PluralValue<${paramDefinition}>(values${valueCount}, ${langKey});`);
                    definition.addParamDefinition(paramDefinition, item.params);
                } else {
                    block2.push(`const pluralValue${valueCount} = new PluralValue(values${valueCount}, ${langKey});`);
                }
                keys[key] = `pluralValue${valueCount}`;
                break;
        }
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

    let declarationLine = `const translationMap = new TranslationMap<${keysDefinition}Record`;

    if (item.params && item.params.length > 0) {
        declarationLine += `, ${paramDefinition}`;
    }
    declarationLine += '>({';

    fileLines.push(declarationLine);
    Object.entries(keys).forEach(([key, value]) => {
        fileLines.push(`    ${key}: ${value},`);
    });
    fileLines.push(`});`);

    fileLines.push('');
    fileLines.push(`const translationFunction = Object.assign(
        (key: keyof ${keysDefinition}Record, params?: Partial<${keysDefinition}Record>) => translationMap.render(key, params),
        {
            map: () => translationMap
        }
    ) as MapExport<${keysDefinition}Record, ${keysDefinition}Record>;`);



    fileLines.push(`export default translationFunction`);


    return fileLines.join('\n');

}
