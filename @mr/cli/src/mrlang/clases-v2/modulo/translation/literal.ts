import {JSONItem, JSONValue, JSONValuePlural, JSONValueSingular} from "../../data";
import {Definition} from "../definition";
import {definitionModulePath, LANG_REGEXPS} from "./common";
import {ModuloJSON} from "../json";

const pascalCase = (str: string, regex: RegExp = /[^a-zA-Z]/) => {
    const words = str.split(regex);
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

export default (lang: string, value: JSONValue, item: JSONItem, module: ModuloJSON, definition: Definition) => {

    const langMatch = LANG_REGEXPS.find(({regex}) => regex.test(lang));
    const langKey = langMatch ? langMatch.lang : lang;

    const fileLines: string[] = [];

    fileLines.push('// NO EDITAR A MANO');
    fileLines.push('');
    fileLines.push(`import {Literal} from "services-comun/modules/traduccion/v2/literal";`);

    const paramDefinition = pascalCase(`${item.id}Params`);

    switch (value.type) {
        case "singular":
            const singularValue = value as JSONValueSingular;
            fileLines.push(`import {SingularValue} from "services-comun/modules/traduccion/v2/value/singular-value";`);
            if (item.params && item.params.length > 0) {
                fileLines.push(`import type {${paramDefinition}} from "${definitionModulePath(module)}";`);
            }
            fileLines.push('');
            fileLines.push(`const value = \`${singularValue.value}\`;`);
            fileLines.push('');

            if (item.params && item.params.length > 0) {
                fileLines.push(`const singularValue = new SingularValue<${paramDefinition}>(value, ["${item.params.join("\", \"")}"]);`);
                fileLines.push('');
                fileLines.push(`const literal = new Literal<${paramDefinition}>(singularValue);`);
                fileLines.push(`export default (params: Partial<${paramDefinition}>) => literal.render(params);`);

                definition.addParamDefinition(paramDefinition, item.params);
            } else {
                fileLines.push(`const singularValue = new SingularValue(value);`);
                fileLines.push('');
                fileLines.push(`const literal = new Literal(singularValue);`);
                fileLines.push(`export default literal.render();`);
            }
            break;
        case "plural":
            const pluralValue = value as JSONValuePlural;
            fileLines.push(`import {${langKey}} from "make-plural/cardinals";`)
            fileLines.push(`import {PluralValue} from "services-comun/modules/traduccion/v2/value/plural-value";`);
            fileLines.push(`import {TPluralKey} from "services-comun/modules/traduccion/v2/value";`);
            if (item.params && item.params.length > 0) {
                fileLines.push(`import type {${paramDefinition}} from "${definitionModulePath(module)}";`);
            }

            fileLines.push('');
            fileLines.push(`const values: Partial<Record<TPluralKey, string>> = {`);
            Object.entries(pluralValue.value).forEach(([key, value]) => {
                fileLines.push(`    ${key}: "${value}",`);
            });
            fileLines.push('};');
            fileLines.push('');

            if (item.params && item.params.length > 0) {
                fileLines.push(`const pluralValue = new PluralValue<${paramDefinition}>(values, ${langKey});`);
                fileLines.push('');
                fileLines.push(`const literal = new Literal<${paramDefinition}>(pluralValue);`);
                fileLines.push(`export default literal.render;`);

                definition.addParamDefinition(paramDefinition, item.params);
            } else {
                fileLines.push(`const pluralValue = new PluralValue(values, ${langKey});`);
                fileLines.push('');
                fileLines.push(`const literal = new Literal(singularValue);`);
                fileLines.push(`export default literal.render;`);
            }
            break;
    }


    return fileLines.join('\n');

}
