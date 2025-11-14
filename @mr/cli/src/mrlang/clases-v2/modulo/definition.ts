import {pascalCase} from "../util/case";

export class Definition {
    /* STATIC */

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

    public content(): string {
        const lines: string[] = [];

        // Importamos utilidades
        lines.push(`import {getLang} from "services-comun/modules/traduccion/v2/util/lang";`);
        lines.push('');

        lines.push(`import {TranslationSet} from "services-comun/modules/traduccion/v2/translation-set";`);
        lines.push(`import {MapExport, TranslationMap} from "services-comun/modules/traduccion/v2/translation-map";`);
        lines.push('');

        if (Object.entries(this._recordsDefinitions).length) {
            lines.push(`import {ITranslationMapKeys} from "services-comun/modules/traduccion/v2/translation-map";`);
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
                lines.push(`export interface ${name}Record extends ITranslationMapKeys {`);
                keys.forEach(key => {
                    lines.push(`    ${key}?: string;`);
                });
                lines.push('}');

                lines.push(`export type ${name}Keys = keyof ${name}Record;`);
            });

            lines.push('');
        }

        if (this._moduleInterface) {
            lines.push(this._moduleInterface);
            lines.push('');
        }

        // Idiomas disponibles
        lines.push(`const IDIOMAS = [${this._langs.map(lang => `'${lang.replace('-', '')}'`).join(', ')}];`);
        lines.push('');

        lines.push(`export default (lang: string, defecto?: string): Promise<${pascalCase(this._name)}> => import(/* webpackChunkName: "i18n/langs/[request]${this._dir}/${this._name}" */ \`i18n/.src/langs/\${getLang(IDIOMAS, lang, defecto)}${this._dir}/${this._name}\`).then(m => m.default);`);

        return lines.join('\n');
    }
}
