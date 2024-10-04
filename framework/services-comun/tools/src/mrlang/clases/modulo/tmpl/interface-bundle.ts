interface ITemplate {
    id: string;
    jerarquia: string[];
    className: string;
    lang?: string;
    langs: string[];
    mapping: Record<string, string>;
}

function getImports(id: string, jerarquia: string[], className: string, langs: string[], mapping: Record<string, string>): string {
    const imports: string[] = [];
    imports.push(`import type {${className}} from ".";`);
    imports.push(`import {check, type Langs} from "../${"../".repeat(jerarquia.length-1)}langs";`);
    imports.sort();
    imports.push("");

    const imports2: string[] = [];
    const importados: string[] = [];
    for (const lang of langs) {
        const idioma = mapping[lang]==undefined ?
            lang.replace("-", "") :
            mapping[lang].replace("-", "");
        if (importados.includes(idioma)) {
            continue;
        }
        imports2.push(`import ${idioma} from "../${"../".repeat(jerarquia.length - 1)}.src/${idioma}/${id.replaceAll("-", "_").replaceAll(".", "/")}";`);
        importados.push(idioma);
    }
    imports.push(imports2.sort().join("\n"));

    return imports.join("\n");
}

export default ({id, jerarquia, className, lang, langs, mapping}: ITemplate)=>{
    return `// NO EDITAR A MANO
${getImports(id, jerarquia, className, langs, mapping)}

const langs: Record<Langs, ${className}> = {
${langs.map(lang=>`    "${lang}": ${mapping[lang]==undefined?lang.replace("-", ""):mapping[lang].replace("-", "")},`).join("\n")}
};

const loader = (lang: string, defecto${lang!=undefined?"?":""}: string): ${className} => langs[check(lang, defecto)];

export {${className}};
export default loader;
`;
};
