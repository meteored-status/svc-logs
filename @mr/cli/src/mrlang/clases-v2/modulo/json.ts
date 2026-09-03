/**
 * Editor: Bixus
 * Fecha: Wed, 02 Sep 2026 14:14:26 GMT
 * Hash: 3bc7a0a98318e29885155ac9d6717b3d
 * Versión: 2026.9.2+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {isFile, readJSON} from "../../../utiles/fs";
import {IModulo, type IModuloConfig as IModuloConfigBase, Modulo} from ".";
import {JSONItem} from "../data";
import {pascalCase} from "../util/case";
import {problemasDePlural} from "./translation/plural";

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

    /**
     * Qué hay mal escrito en el módulo, en frases listas para enseñar y ya localizadas en su entrada.
     *
     * Se comprueba **antes de generar nada**, y por eso existe: lo que valida hoy —que un plural diga cuál de
     * sus parámetros es el contador— es un dato que falta en el `.json`, no un fallo del código generado. Sin
     * esto el hueco se rellenaba solo en tiempo de ejecución, eligiendo la forma del cero, y se veía en
     * pantalla o no se veía nunca.
     *
     * @returns Los problemas encontrados, vacío si el módulo está bien.
     */
    public validar(): string[] {
        return this.traducciones().flatMap(item =>
            problemasDePlural(item).map(problema => `${this.path()}/${this.name()} › ${item.id}: ${problema}`)
        );
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
                imports.push(`${pascalCase(translation.id)}Keys`);
            }

            if (translation.params && translation.params.length > 0) {
                imports.push(`${pascalCase(translation.id)}Params`);
            }
        });

        indexLines.push(`import {\n${imports.join(",\n    ")}\n} from "${"../".repeat(subDirsCount)}definitions${this.path()}/${this.id}";`);
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

        indexLines.push('');
        indexLines.push(`    public constructor() {`);
        simpleTranslations.forEach(translation => {
            indexLines.push(`        this.${translation.id} = ${translation.id};`);
        });
        indexLines.push(`    }`);
        indexLines.push('');

        otherTranslations.forEach(translation => {
            if (translation.tipo == 'map' || translation.tipo == 'set') {
                indexLines.push(`    public ${translation.id} = ${translation.id};`);
            } else {
                const args: string[] = [];

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

            }
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
            } else if (translation.tipo == 'map') {
                const args: string[] = [];

                args.push(`${pascalCase(translation.id)}Keys`);

                if (translation.params && translation.params.length > 0) {
                    args.push(`Partial<${pascalCase(translation.id)}Params>`);
                }

                indexLines.push(`    ${translation.id}: TranslationMap<${args.join(', ')}>;`);
            } else if (translation.tipo == 'set') {
                indexLines.push(`    ${translation.id}: TranslationSet${translation.params && translation.params.length > 0 ? `<${pascalCase(translation.id)}Params>` : ''};`);
            } else {
                const args: string[] = [];

                if (translation.params && translation.params.length > 0) {
                    args.push(`params: Partial<${pascalCase(translation.id)}Params>`);
                }

                indexLines.push(`    ${translation.id}: (${args.join(', ')}) => string;`);
            }
        });
        indexLines.push('}');

        return indexLines.join("\n");
    }
}
