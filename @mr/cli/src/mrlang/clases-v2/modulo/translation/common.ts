/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 0ceea312eca7da8dc2f9016644c66cca
 */

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

export const langModulePath = (modulePath: string, moduleName: string, lang: string): string => {
    const dirs = modulePath.split('/');
    const subDirsCount = dirs.length + 1; // + for the /langs directory
    return `${"../".repeat(subDirsCount)}langs/${lang}${modulePath}/${moduleName}`;
}
