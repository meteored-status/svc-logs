interface IParametros {
    lang?: string;
    langs: string[];
}

function checkSimple(): string {
    return `lang = defecto;`;
}

function checkAmpliado(): string {
    return `if (lang.length>2) {
        lang = lang.substring(0, 2);
        if (SOPORTADOS.indexOf(lang)<0) {
            lang = defecto;
        }
    } else {
        lang = defecto;
    }`;
}

export default ({lang, langs}: IParametros): string =>{
    const [max, min] = langs.reduce((a, b)=>[Math.max(a[0], b.length), Math.min(a[1], b.length)], [0, Infinity]);
    return `// NO EDITAR A MANO
export type Langs = "${langs.join('" | "')}";

export const SOPORTADOS: string[] = ["${langs.join('", "')}"];

export function check(lang: string, defecto: string${lang!=undefined?` = "${lang}"`:""}, mapping: Record<string, string> = {}): Langs {
    if (SOPORTADOS.indexOf(lang)<0) {
        ${min==2 && max>2 ? checkAmpliado() : checkSimple()}
    }
    if (mapping[lang]!=undefined) {
        lang = mapping[lang];
    }

    return lang as Langs;
}

export const checkClean = (lang: string, defecto${lang!=undefined?"?":""}: string, mapping: Record<string, string> = {}): string => check(lang, defecto, mapping).replace("-", "");
`;
}
