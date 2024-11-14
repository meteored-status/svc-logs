import {ModuloJSON} from "../json";
import {ITraduccionBase, TraduccionTipo} from "../traduccion";

interface ITemplate {
    id: string;
    jerarquia: string[];
    className: string;
    submodulos: ModuloJSON[];
    valores: ITraduccionBase[];
    lang?: string;
    mapping: Record<string, string>;
}

function getImports(jerarquia: string[], valores: ITraduccionBase[], submodulos: ModuloJSON[]): string {
    const tipos: string[] = [];
    for (const valor of valores) {
        if (!tipos.includes(valor.tipo)) {
            tipos.push(valor.tipo);
        }
    }
    tipos.sort();

    const imports: string[] = [];

    if (tipos.includes("map")) {
        imports.push(`import {ITraduccionMapKeys} from "services-comun/modules/traduccion/map";`);
    }

    if (imports.length>0) {
        imports.push("");
    }

    if (submodulos.length>0) {

        for (const modulo of submodulos) {
            const id = modulo.base_id.replaceAll("-", "_");
            imports.push(`import type {${modulo.className}} from "./${id}";`);
        }
    }
    imports.push(`import {checkClean} from "../${`../`.repeat(jerarquia.length-1)}langs";`);

    if (imports.length>0) {
        imports.push("");
        imports.push("");
    }

    return imports.join("\n");
}

function getParams(valores: ITraduccionBase[]): string {
    const tipos: string[] = [];
    const params: string[] = [];
    for (const valor of valores) {
        if (valor.params==undefined || valor.params.length==0) {
           continue;
        }
        tipos.push(`export type ${valor.className}Param = "${valor.params.toSorted().join(`" | "`)}";`);
        params.push(`export type ${valor.className}Params = Record<${valor.className}Param, string|number>;`);
    }

    const salida: string[] = [];
    if (tipos.length>0) {
        salida.push(tipos.join("\n"));
        if (params.length>0) {
            salida.push("");
        }
    }
    if (params.length>0) {
        salida.push(params.join("\n"));
    }
    if (salida.length>0) {
        salida.push("");
        salida.push("");
    }

    return salida.join("\n");
}

function getKeys(valores: ITraduccionBase[]): string {
    const keys: string[] = [];
    for (const valor of valores) {
        if (valor.keys==undefined) {
            continue;
        }
        const key: string[] = [];
        for (const actual of valor.keys) {
            key.push(`    "${actual}"?: string;`);
        }
        const actual: string[] = [];
        actual.push(`export interface ${valor.className}Record extends ITraduccionMapKeys {\n${key.join("\n")}\n}`);
        actual.push(`export type ${valor.className}Keys = keyof ${valor.className}Record;`);
        keys.push(actual.join("\n"));
        keys.push("");
    }

    if (keys.length>0) {
        keys.push("");
    }

    return keys.join("\n");
}

function getInterface(className: string, valores: ITraduccionBase[], submodulos: ModuloJSON[]): string {
    const salida: string[] = [];
    for (const submodulo of submodulos) {
        const id = submodulo.base_id.replaceAll("-", "_");
        salida.push(`    ${id}: ${submodulo.className};`);
    }
    for (const valor of valores) {
        const id = valor.id.replaceAll("-", "_");
        switch(valor.tipo) {
            case TraduccionTipo.literal:
                if (valor.params==undefined || valor.params.length==0) {
                    salida.push(`    ${id}: string;`);
                } else {
                    salida.push(`    ${id}: (params?: Partial<${valor.className}Params>)=>string;`);
                }
                break;
            case TraduccionTipo.plural:
                if (valor.params==undefined || valor.params.length==0) {
                    salida.push(`    ${id}: (i: number)=>string;`);
                } else {
                    salida.push(`    ${id}: (i: number, params?: Partial<${valor.className}Params>)=>string;`);
                }
                break;
            case TraduccionTipo.set:
                if (valor.params==undefined || valor.params.length==0) {
                    salida.push(`    ${id}: (i: number)=>string;`);
                } else {
                    salida.push(`    ${id}: (i: number, params?: Partial<${valor.className}Params>)=>string;`);
                }
                break;
            case TraduccionTipo.map:
                if (valor.params==undefined || valor.params.length==0) {
                    salida.push(`    ${id}: (key: ${valor.className}Keys)=>string;`);
                } else {
                    salida.push(`    ${id}: (key: ${valor.className}Keys, params?: Partial<${valor.className}Params>)=>string;`);
                }
                break;
        }
    }

    return `export interface ${className} {\n${salida.sort().join("\n")}\n}`;
}

export default ({id, jerarquia, className, valores, submodulos, lang, mapping}: ITemplate)=>{
    valores.sort((a, b)=>a.className.localeCompare(b.className));

    return `// NO EDITAR A MANO
${getImports(jerarquia, valores, submodulos)}${getParams(valores)}${getKeys(valores)}${getInterface(className, valores, submodulos)}

const MAPPING: Record<string, string> = ${JSON.stringify(mapping, null, 4)};

export default (lang: string, defecto${lang!=undefined?"?":""}: string): Promise<${className}> => import(/* webpackChunkName: "i18n/[request]/${id}" */ \`i18n/.src/$\{checkClean(lang, defecto, MAPPING)}/${id.replaceAll("-", "_").replaceAll(".", "/")}\`).then(module=> module.default);
`;
};
