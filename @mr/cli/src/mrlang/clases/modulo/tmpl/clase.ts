import {ModuloJSON} from "../json";
import {type ITraduccionBase, TraduccionTipo} from "../traduccion";

interface IParametros {
    id: string;
    jerarquia: string[];
    version: string;
    hash: string;
    className: string;
    submodulos: ModuloJSON[];
    valores: ITraduccionBase[];
}

function getImports(id: string, jerarquia: string[], className: string, valores: ITraduccionBase[], submodulos: ModuloJSON[]): string {
    const tipos: string[] = [];
    const params: string[] = [];
    for (const valor of valores) {
        if (!tipos.includes(valor.tipo)) {
            tipos.push(valor.tipo);
        }
        if (valor.keys!=undefined) {
            params.push(`${valor.className}Keys`);
        }
        if (valor.params!=undefined && valor.params.length>0) {
            params.push(`${valor.className}Params`);
        }
    }
    tipos.sort();

    const imports: string[] = [];
    if (params.length==0) {
        imports.push(`import type {${className} as Modulo} from "../../${"../".repeat(jerarquia.length)}${id.replaceAll("-", "_").replaceAll(".", "/")}";`);
    } else {
        imports.push(`import type {\n    ${className} as Modulo,\n    ${params.sort().join(",\n    ")}\n} from "../../${"../".repeat(jerarquia.length)}${id.replaceAll("-", "_").replaceAll(".", "/")}";`);
    }

    if (submodulos.length>0) {
        for (const modulo of submodulos) {
            const id = modulo.id.replaceAll("-", "_");
            imports.push(`import type {${modulo.className}} from "../../${"../".repeat(jerarquia.length)}${id.replaceAll("-", "_").replaceAll(".", "/")}";`);
        }
    }

    if (submodulos.length>0) {
        imports.push("");
        for (const modulo of submodulos) {
            const id = modulo.base_id.replaceAll("-", "_");
            imports.push(`import ${id} from "./${id}";`);
        }
    }

    if (valores.length>0) {
        imports.push("");
        for (const valor of valores) {
            const id = valor.id.replaceAll("-", "_");
            imports.push(`import ${id} from "./${id}";`);
        }
    }

    return imports.join("\n");
}

function getPropiedades(valores: ITraduccionBase[], submodulos: ModuloJSON[]): string {
    const salida1: string[] = [];
    for (const modulo of submodulos) {
        const id = modulo.base_id.replaceAll("-", "_");
        salida1.push(`    public readonly ${id}: ${modulo.className};`);
    }

    const salida2: string[] = [];
    for (const valor of valores) {
        if (valor.tipo==TraduccionTipo.literal && (valor.params==undefined || valor.params.length==0)) {
            const id = valor.id.replaceAll("-", "_");
            salida2.push(`    public readonly ${id}: string;`);
        }
    }

    const salida: string[] = [];
    if (salida1.length>0) {
        salida.push(salida1.join("\n"));
        if (salida2.length>0) {
            salida.push("");
        }
    }
    if (salida2.length>0) {
        salida.push(salida2.join("\n"));
    }

    if (salida.length>0) {
        salida.unshift("");
        salida.push("");
    }

    return salida.join("\n");
}

function getConstructor(valores: ITraduccionBase[], submodulos: ModuloJSON[]): string {
    const salida: string[] = [];
    for (const modulo of submodulos) {
        const id = modulo.base_id.replaceAll("-", "_");
        salida.push(`        this.${id} = ${id};`);
    }
    for (const valor of valores) {
        const id = valor.id.replaceAll("-", "_");

        if (valor.tipo==TraduccionTipo.literal && (valor.params==undefined || valor.params.length==0)) {
            salida.push(`        this.${id} = ${id};`);
        // } else {
        //     salida.push(`        this.#${id} = ${id};`);
        }
    }

    return salida.sort().join("\n");
}

function getMetodos(valores: ITraduccionBase[]): string {
    const salida: string[] = [];
    for (const valor of valores) {
        if (valor.tipo==TraduccionTipo.literal && (valor.params==undefined || valor.params.length==0)) {
            continue;
        }

        const id = valor.id.replaceAll("-", "_");
        switch (valor.tipo) {
            case TraduccionTipo.literal:
                salida.push(`    public ${id}(params: Partial<${valor.className}Params> = {}) { return ${id}.render(params); }`);
                break;
            case TraduccionTipo.map:
                if (valor.params==undefined || valor.params.length==0) {
                    salida.push(`    public ${id}(key: ${valor.className}Keys) { return ${id}.render(key); }`);
                } else {
                    salida.push(`    public ${id}(key: ${valor.className}Keys, params: Partial<${valor.className}Params> = {}) { return ${id}.render(key, params); }`);
                }
                break;
            case TraduccionTipo.plural:
                if (valor.params==undefined || valor.params.length==0) {
                    salida.push(`    public ${id}(i: number) { return ${id}.render(i); }`);
                } else {
                    salida.push(`    public ${id}(i: number, params: Partial<${valor.className}Params> = {}) { return ${id}.render(i, params); }`);
                }
                break;
            case TraduccionTipo.set:
                if (valor.params==undefined || valor.params.length==0) {
                    salida.push(`    public ${id}(i: number) { return ${id}.render(i); }`);
                } else {
                    salida.push(`    public ${id}(i: number, params: Partial<${valor.className}Params> = {}) { return ${id}.render(i, params); }`);
                }
                break;
        }
    }

    if (salida.length>0) {
        salida.unshift("");
    }

    return salida.join("\n");
}

export default ({id, jerarquia, version, hash, className, valores, submodulos}: IParametros): string =>{
    valores.sort((a, b)=>a.className.localeCompare(b.className));

    return `// NO EDITAR A MANO
${getImports(id, jerarquia, className, valores, submodulos)}

class ${className} implements Modulo {
    /* STATIC */
    // public static ID: string = "${id}";
    // public static VERSION: string = "${version}";
    // public static HASH: string = "${hash}";

    /* INSTANCE */${getPropiedades(valores, submodulos)}
    public constructor() {
${getConstructor(valores, submodulos)}
    }
${getMetodos(valores)}
}

export default new ${className}();
`;
}
