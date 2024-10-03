import {ModuloJSON} from "../json";

interface IParametros {
    lang: string;
    modulos: ModuloJSON[];
    langs: Record<string, Record<string, string[]>>;
}

function getImports(modulos: ModuloJSON[]): string {
    const imports: string[] = [];
    for (const modulo of modulos) {
        const id = modulo.id.replaceAll("-", "_");
        imports.push(`import type {${modulo.className}} from "../../${id}";`);
    }

    if (imports.length>0) {
        imports.unshift("");
    }

    return imports.join("\n");
}

function getGetters(lang: string, modulos: ModuloJSON[], langs: Record<string, Record<string, string[]>>): string {
    const original = lang;
    lang = lang.replace("-", "");

    const getters: string[] = [];
    for (const modulo of modulos) {
        const id = modulo.id.replaceAll("-", "_").replaceAll(".", "/");
        let ok = false;
        for (const key of Object.keys(langs[modulo.id])) {
            if (langs[modulo.id][key].includes(original) || key=="_") {
                getters.push(`    public get ${id}(): Promise<${modulo.className}> { return import(/* webpackChunkName: "i18n/${key}/${modulo.id.replace("-", "_").replace(".", "/")}" */ "i18n/.src/${key.replace("-", "")}/${id}").then(module=> module.default); }`);
                ok = true;
                break;
            }
        }
        if (!ok) {
            getters.push(`    public get ${id}(): Promise<${modulo.className}> { return import(/* webpackChunkName: "i18n/${lang}/${modulo.id.replace("-", "_").replace(".", "/")}" */ "i18n/.src/${lang}/${id}").then(module=> module.default); }`);
        }
    }

    if (getters.length>0) {
        getters.unshift("");
        getters.push("");
    }

    return getters.join("\n");
}

export default ({lang, modulos, langs}: IParametros): string =>{
    modulos.sort((a, b)=>a.className.localeCompare(b.className));

    return `// NO EDITAR A MANO
import type {ModuloLoader} from "../..";${getImports(modulos)}

class Modulo implements ModuloLoader {
    /* INSTANCE */${getGetters(lang, modulos, langs)}
    public constructor() {
    }
}

export default new Modulo();
`;
}
