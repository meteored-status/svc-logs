import {isFile, readJSON} from "services-comun/modules/utiles/fs";

import {IModulo, type IModuloConfig as IModuloConfigBase, Modulo} from ".";
import {JSONItem} from "../data";
import {pascalCase} from "../util/case";

export interface IModuloJSON extends IModulo {
    traducciones: JSONItem[];
}

interface IModuloConfig extends IModuloConfigBase {
    jsondir: string;
    relativePath: string;
}

export class ModuloJSON extends Modulo<IModuloConfig> {
    /* STATIC */
    public static async load(baseDir: string, file: string): Promise<ModuloJSON> {

        // Cargamos fichero
        const filePath = `${baseDir}/${file}`;

        if (!await isFile(filePath)) {
            return Promise.reject(`No existe el modulo ${file}`);
        }

        const module = await readJSON<IModuloJSON>(filePath);
        module.id = file.replace('.json', '');

        return new this(module, {
            jsondir: baseDir,
            relativePath: baseDir.split('.json')[1],
        });
    }

    /* INSTANCE */
    protected override get original(): IModuloJSON {
        return super.original as IModuloJSON;
    }

    public name(): string {
        return this.original.id.replace('.json', '');
    }

    public path(): string {
        return this.config.relativePath;
    }

    public traducciones() {
        return this.original.traducciones;
    }

    public moduleLangs(): string[] {
        return Array.from(new Set(this.traducciones().map(jsonItem => Object.keys(jsonItem.values.valor)).flat()));
    }

    public generateLangIndex(): string {

        const simpleTranslations = this.traducciones().filter(t => t.tipo == "literal" && (t.params || []).length == 0);
        const otherTranslations = this.traducciones().filter(t => simpleTranslations.map(st => st.id).indexOf(t.id) == -1);

        const indexLines: string[] = [];

        const dirs = this.config.relativePath.split('/');
        const subDirsCount = dirs.length + 2; // +2 for the <lang> directory and /langs directory

        indexLines.push(`// NO EDITAR A MANO`);
        indexLines.push('');

        const imports: string[] = [];

        imports.push(`    ${pascalCase(this.name())} as Module`);

        otherTranslations.forEach(translation => {
            if (translation.tipo == "map") {
                imports.push(`${pascalCase(translation.id)}Record`);
            }

            if (translation.params && translation.params.length > 0) {
                imports.push(`${pascalCase(translation.id)}Params`);
            }
        });

        indexLines.push(`import {\n${imports.join(",\n    ")}\n} from "${"../".repeat(subDirsCount)}definitions${this.path()}/${this.id}";`);

        indexLines.push('');

        indexLines.push(`import {TranslationSet} from "services-comun/modules/traduccion/v2/translation-set";`);
        indexLines.push(`import {MapExport, TranslationMap} from "services-comun/modules/traduccion/v2/translation-map";`);
        indexLines.push('');

        this.traducciones().forEach(translation => {
            indexLines.push(`import ${translation.id} from "./${translation.id}";`);
        });
        indexLines.push('');

        indexLines.push(`class ${pascalCase(this.name())} implements Module {`);
        indexLines.push('');

        simpleTranslations.forEach(translation => {
            indexLines.push(`    public readonly ${translation.id}: string;`);
        });

        const setTranslations = otherTranslations.filter(t => t.tipo == "set")
        setTranslations.forEach( s => indexLines.push(`    public readonly ${s.id}: TranslationSet;`))

        const mapTranslations = otherTranslations.filter(t => t.tipo == "map")
        mapTranslations.forEach( s => {
            const record = `${pascalCase(s.id)}Record`;
            indexLines.push(`    public readonly ${s.id}: MapExport<${record}, ${record}>;`)
        })

        indexLines.push('');
        indexLines.push(`    public constructor() {`);
        simpleTranslations.forEach(translation => {
            indexLines.push(`        this.${translation.id} = ${translation.id};`);
        });
        setTranslations.forEach(translation => indexLines.push(`        this.${translation.id} = ${translation.id};`));
        mapTranslations.forEach(translation => indexLines.push(`        this.${translation.id} = ${translation.id};`));
        indexLines.push(`    }`);
        indexLines.push('');

        otherTranslations.forEach(translation => {
            const args: string[] = [];

            if (translation.tipo == "map") {
                return;
            } else if (translation.tipo == "set") {
                return;
            }

            if (translation.params && translation.params.length > 0) {
                args.push(`params: Partial<${pascalCase(translation.id)}Params>`);
            }


            indexLines.push(`    public ${translation.id}(${args.join(', ')}) {return ${translation.id}(${args.map(arg => {
                if (arg.includes('key')) {
                    return `key`;
                } else if (arg.includes('idx')) {
                    return `idx`;
                } else if (arg.includes('params')) {
                    return `params`;
                }
                return '';
            }).join(', ')})};`);
        });

        indexLines.push(`}`);
        indexLines.push('');

        indexLines.push(`export default new ${pascalCase(this.name())}();`);

        return indexLines.join("\n");
    }

    public generateIndex(): string {

        const indexLines: string[] = [];

        indexLines.push(`export interface ${pascalCase(this.name())} {`);
        this.traducciones().forEach(translation => {
            if (translation.tipo == "literal" && (!translation.params || translation.params.length == 0)) {
                indexLines.push(`    ${translation.id}: string;`);
            } else {
                const args: string[] = [];
                if (translation.tipo == "map") {
                    args.push(`${pascalCase(translation.id)}Keys`);
                } else if (translation.tipo == "set") {
                    args.push(``);
                }

                if (translation.params && translation.params.length > 0) {
                    args.push(`params: Partial<${pascalCase(translation.id)}Params>`);
                }

                if(translation.tipo == "set")
                    indexLines.push(`    ${translation.id}: TranslationSet;`);
                else if(translation.tipo == "map") {
                    indexLines.push(`    ${translation.id}: MapExport<${pascalCase(translation.id)}Record, {}>`);
                }
                else
                    indexLines.push(`    ${translation.id}: (${args.join(', ')}) => string;`);
            }
        });
        indexLines.push('}');

        return indexLines.join("\n");
    }
}
