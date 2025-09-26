import {ModuloJSON} from "../json";

export const LANG_REGEXPS = [
    {
        regex: /^es-([A-Z\d]{2,3})$/i,
        lang: 'es'
    },
    {
        regex: /^en-([A-Z\d]{2,3})$/i,
        lang: 'en'
    },
    {
        regex: /^pt-PT|pt$/i,
        lang: 'pt_PT'
    },
    {
        regex: /^pt-BR$/i,
        lang: 'pt'
    }
];

export const definitionModulePath = (module: ModuloJSON) => {
    const dirs = module.path().split('/');
    const subDirsCount = dirs.length + 2; // +2 for the <lang> directory and /langs directory
    return `${"../".repeat(subDirsCount)}definitions${module.path()}/${module.name()}`;
}
