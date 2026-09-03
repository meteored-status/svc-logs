/**
 * Editor: Bixus
 * Fecha: Wed, 02 Sep 2026 14:49:28 GMT
 * Hash: 4229cb648d4d85d986eb92c32d8b0fd8
 * Versión: 2026.9.2+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
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
        // Anclada **entera**: `/^pt-PT|pt$/` se lee como `(^pt-PT)|(pt$)`, porque la alternancia es lo que
        // menos ata, así que casaba cualquier código *terminado* en «pt» —`egypt`, `apt`— y dejaba fuera lo
        // que se pretendía. Con los idiomas de hoy no se notaba; se notaría al añadir uno.
        regex: /^(pt-PT|pt)$/i,
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
