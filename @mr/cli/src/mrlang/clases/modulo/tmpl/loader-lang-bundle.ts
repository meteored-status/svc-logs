import {ModuloJSON} from "../json";

interface IParametros {
    lang: string;
    modulos: ModuloJSON[];
    langs: Record<string, Record<string, string[]>>;
}

function getImports(lang: string, modulos: ModuloJSON[], langs: Record<string, Record<string, string[]>>): string {
    const imports: string[] = [];
    for (const modulo of modulos) {
        const id = modulo.id.replaceAll("-", "_");
        imports.push(`import type {${modulo.className}} from "../../${id}";`);
    }

    if (imports.length>0) {
        imports.sort();
        imports.unshift("");
        imports.push("");
        const original = lang;
        lang = lang.replace("-", "");
        for (const modulo of modulos) {
            const id = modulo.id.replaceAll("-", "_").replaceAll(".", "/");
            let ok = false;
            for (const key of Object.keys(langs[modulo.id])) {
                // console.log(key, original, langs[modulo.id][key]);
                if (langs[modulo.id][key].includes(original) || key=="_") {
                    imports.push(`import ${id} from "i18n/.src/${key.replace("-", "")}/${id}";`);
                    ok = true;
                    break;
                }
            }
            if (!ok) {
                imports.push(`import ${id} from "i18n/.src/${lang}/${id}";`);
            }
        }
    }

    return imports.join("\n");
}

export default ({lang, modulos, langs}: IParametros): string =>{
    modulos.sort((a, b)=>a.className.localeCompare(b.className));

    return `// NO EDITAR A MANO
import type {ModuloLoader} from "../../bundle";${getImports(lang, modulos, langs)}

class Modulo implements ModuloLoader {
    /* INSTANCE */
${modulos.map(modulo=>`    public readonly ${modulo.base_id.replaceAll("-", "_")}: ${modulo.className};`).join("\n")}

    public constructor() {
${modulos.map(modulo=>`        this.${modulo.base_id.replaceAll("-", "_")} = ${modulo.base_id.replaceAll("-", "_")};`).join("\n")}
    }
}

export default new Modulo();
`;
}
