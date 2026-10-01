/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 5d534f189e34fca42183bd6d0fc596f6
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {ModuloJSON} from "../json";

interface IParametros {
    modulos: ModuloJSON[];
    lang?: string;
    langs: string[];
    mapping: Record<string, string>;
}

function getImports(langs: string[], modulos: ModuloJSON[], mapping: Record<string, string>): string {
    const imports: string[] = [];
    imports.push(`import {check, type Langs} from "./langs";`);
    for (const modulo of modulos) {
        const id = modulo.id.replaceAll("-", "_");
        imports.push(`import type {${modulo.className}} from "./${id}";`);
    }
    imports.sort();
    imports.push("");

    const imports2: string[] = [];
    const importados: string[] = [];
    for (const lang of langs) {
        const id = mapping[lang]==undefined ?
            lang.replace("-", "") :
            mapping[lang].replace("-", "");
        if (importados.includes(id)) {
            continue;
        }
        imports2.push(`import ${id} from "./.src/${id}/bundle";`);
        importados.push(id);
    }
    imports.push(imports2.toSorted().join("\n"));

    return imports.join("\n");
}

function getInterfaces(modulos: ModuloJSON[]): string {
    const imports: string[] = [];
    for (const modulo of modulos) {
        const id = modulo.id.replaceAll("-", "_");
        imports.push(`    ${id}: ${modulo.className};`);
    }

    return imports.join("\n");
}

export default ({modulos, lang, langs, mapping}: IParametros): string =>{
    modulos.sort((a, b)=>a.className.localeCompare(b.className));
    langs.sort();

    return `// NO EDITAR A MANO
${getImports(langs, modulos, mapping)}

export interface ModuloLoader {
${getInterfaces(modulos)}
}

const langs: Record<Langs, ModuloLoader> = {
${langs.map(lang=>`    "${lang}": ${mapping[lang]==undefined?lang.replace("-", ""):mapping[lang].replace("-", "")},`).join("\n")}
};

export default (lang: string, defecto${lang!=undefined?"?":""}: string): ModuloLoader => langs[check(lang, defecto)];
`;
}
