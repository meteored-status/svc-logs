import {ModuloJSON} from "../json";

interface IParametros {
    modulos: ModuloJSON[];
    lang?: string;
    mapping: Record<string, string>;
}

function getImports(modulos: ModuloJSON[]): string {
    const imports: string[] = [];
    for (const modulo of modulos) {
        const id = modulo.id.replaceAll("-", "_");
        imports.push(`import type {${modulo.className}} from "./${id}";`);
    }

    return imports.join("\n");
}

function getInterfaces(modulos: ModuloJSON[]): string {
    const imports: string[] = [];
    for (const modulo of modulos) {
        const id = modulo.id.replaceAll("-", "_");
        imports.push(`    ${id}: Promise<${modulo.className}>;`);
    }

    if (imports.length>0) {
        imports.unshift("");
    }

    return imports.join("\n");
}

export default ({modulos, lang, mapping}: IParametros): string =>{
    modulos.sort((a, b)=>a.className.localeCompare(b.className));

    return `// NO EDITAR A MANO
${getImports(modulos)}
import {checkClean} from "./langs";

export interface ModuloLoader {${getInterfaces(modulos)}
}

const MAPPING: Record<string, string> = ${JSON.stringify(mapping, null, 4)};

export default (lang: string, defecto${lang!=undefined?"?":""}: string): Promise<ModuloLoader> => import(/* webpackChunkName: "i18n/[request]" */ \`i18n/.src/$\{checkClean(lang, defecto, MAPPING)}/\`).then(module=> module.default);
`;
}
