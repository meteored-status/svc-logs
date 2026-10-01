/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 522f3519ab5463d29ec003f5a835977c
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.17+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {flattenLang} from "../../../modules/util/lang";
import {pascalCase} from "../util/case";
import {langModulePath} from "./translation/common";

export class Definition {
    /* INSTANCE */

    private readonly _paramDefinitions: Record<string, string[]>;
    private readonly _recordsDefinitions: Record<string, string[]>;
    private _moduleInterface: string | undefined;

    public constructor(
        private readonly _name: string,
        private readonly _basedir: string,
        private readonly _dir: string,
        private readonly _langs: string[]) {
        this._paramDefinitions = {};
        this._recordsDefinitions = {};
    }

    public addParamDefinition(name: string, params: string[]): void {
        if (!this._paramDefinitions[name]) {
            this._paramDefinitions[name] = params;
        }
    }

    public addRecordDefinitionEntry(name: string, key: string): void {
        if (!this._recordsDefinitions[name]) {
            this._recordsDefinitions[name] = [];
        }
        if (!this._recordsDefinitions[name].includes(key)) {
            this._recordsDefinitions[name].push(key);
        }
    }

    public set moduleInterface(content: string) {
        this._moduleInterface = content;
    }

    public dir(): string {
        return `${this._basedir}${this._dir}/${this._name}`;
    }

    public path(): string {
        return `${this.dir()}/index.ts`;
    }

    public index(): string {
        const lines: string[] = [];

        // Básicos
        lines.push(`/* NO EDITAR - Archivo generado automáticamente por mrlang */`);
        lines.push('');

        // Importamos utilidades
        lines.push(`import {getLang} from "@mr/core-i18n/util/lang";`);
        lines.push('');
        lines.push(`import {TranslationSet} from "@mr/core-i18n/translation-set";`);
        lines.push('');

        if (Object.entries(this._recordsDefinitions).length) {
            lines.push(`import {TranslationMap} from "@mr/core-i18n/translation-map";`);
            lines.push('');
        }

        if (Object.entries(this._paramDefinitions).length) {
            Object.entries(this._paramDefinitions).forEach(([name, paramNames]) => {
                lines.push(`export type ${name.slice(0, -1)} = ${paramNames.map(pName => `"${pName}"`).join(' | ')};`);
            });
            lines.push('');
        }

        if (Object.entries(this._paramDefinitions).length) {
            Object.keys(this._paramDefinitions).forEach(name => {
                lines.push(`export type ${name} = Record<${name.slice(0, -1)}, string|number>;`);
            });
            lines.push('');
        }

        if (Object.entries(this._recordsDefinitions).length) {
            Object.entries(this._recordsDefinitions).forEach(([name, keys]) => {
                lines.push(`export type ${name}Keys = ${keys.map(k => `"${k}"`).join(' | ')};`);
            });

            lines.push('');
        }

        if (this._moduleInterface) {
            lines.push(this._moduleInterface);
            lines.push('');
        }

        // Idiomas disponibles
        lines.push(`const IDIOMAS = [${this._langs.map(lang => `'${flattenLang(lang)}'`).join(', ')}];`);
        lines.push('');

        lines.push(`export default (lang: string, defecto?: string): Promise<${pascalCase(this._name)}> => import(/* webpackChunkName: "i18n/langs/[request]${this._dir}/${this._name}" */ \`i18n/.src/langs/\${getLang(IDIOMAS, lang, defecto)}${this._dir}/${this._name}\`).then(m => m.default);`);

        return lines.join('\n');
    }

    public bundle(): string {
        const lines: string[] = [];

        // Importamos utilidades
        lines.push(`import {getLang} from "@mr/core-i18n/util/lang";`);
        lines.push('');

        // Imports
        lines.push(`import {${pascalCase(this._name)}} from ".";`);
        lines.push('');

        this._langs.map(flattenLang).forEach(lang => {
            lines.push(`import ${lang} from "${langModulePath(this._dir, this._name, lang)}";`);
        });
        lines.push('');

        // Idiomas disponibles
        lines.push(`const IDIOMAS: string[] = [${this._langs.map(lang => `'${flattenLang(lang)}'`).join(', ')}] as const;`);
        lines.push(`type TLang = typeof IDIOMAS[number];`)
        lines.push('');

        lines.push(`const langs: Record<TLang, ${pascalCase(this._name)}> = {`);
        this._langs.map(flattenLang).forEach(lang => {
            lines.push(`    ${lang}: ${lang},`);
        });
        lines.push(`};`);
        lines.push('');

        lines.push(`export default (lang: string, defecto?: string): ${pascalCase(this._name)} => langs[getLang(IDIOMAS, lang, defecto)];`)

        return lines.join('\n');
    }
}
