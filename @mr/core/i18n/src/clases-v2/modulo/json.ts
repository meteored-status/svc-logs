/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 28 Sep 2026 06:38:15 GMT
 * Hash: 13bc9a82e66f8926056f03bb17d2152b
 * Versión: 2026.9.28+1-juancmartinez
 * Anterior: 2026.9.23+1-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-panel-frontend.git
 */

import {isFile, readJSON} from "@mr/core-cli/fs";

import type {IModulo} from ".";
import {type IModuloConfig as IModuloConfigBase, Modulo} from ".";
import type {JSONItem} from "../data";
import {pascalCase} from "../util/case";
import type {IEntradaEmitida} from "./translation/common";
import {avisosDeIdioma} from "./translation/idiomas";
import {avisosDePlural, problemasDePlural} from "./translation/plural";

export interface IModuloJSON extends IModulo {
    traducciones: JSONItem[];
}

/**
 * Palabras reservadas de JavaScript/TypeScript que un `id` no puede usar: `generateLangIndex()`
 * declara `const <id> = (() => {...})();` para cada entrada, así que un `id` reservado no compila.
 *
 * Lista estándar de ECMAScript más las de modo estricto y módulos (`await`, `enum`, `implements`,
 * `interface`, `package`, `private`, `protected`, `public`, `static`, `let`, `yield`), que es donde
 * vive de hecho el código generado: una clase con métodos y, desde este cambio, cada entrada en su
 * propia función flecha.
 */
const PALABRAS_RESERVADAS = new Set([
    "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do",
    "else", "export", "extends", "false", "finally", "for", "function", "if", "import", "in",
    "instanceof", "new", "null", "return", "super", "switch", "this", "throw", "true", "try",
    "typeof", "var", "void", "while", "with",
    "await", "enum", "implements", "interface", "package", "private", "protected", "public",
    "static", "let", "yield",
]);

/**
 * Un identificador de JavaScript según la gramática de ECMAScript (`IdentifierName`): empieza por un
 * carácter `ID_Start`, `$` o `_`, y sigue con `ID_Continue`, `$`, ZWNJ o ZWJ.
 *
 * Con las clases de Unicode y no con `[A-Za-z_$][\w$]*`: los `id` del proyecto llevan tildes
 * —`cerrar_sesión`, `un_día_prueba`, `un_envío`— y son identificadores válidos (`const cerrar_sesión = 1`
 * compila y ejecuta). Un regex ASCII los rechazaría sin que haya nada mal escrito. Lo que sí caza es lo
 * que de verdad no compila como nombre de constante: un `id` que empieza por dígito, o que lleva un guion,
 * un punto o un espacio.
 */
const IDENTIFICADOR = /^[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*$/u;

/**
 * Nombres que `generateLangIndex()` ya declara **en la raíz** del `index.ts` de un idioma×módulo:
 * `Module` es el tipo de la cabecera (la propia `generateLangIndex()`, más abajo en este fichero) y
 * el resto son los símbolos que importan los emisores de entrada —`valor.ts`, `literal.ts`,
 * `map.ts`, `set.ts`— para construir sus `Literal`/`TranslationMap`/`TranslationSet`. Ni un `id` ni
 * `pascalCase(this.name())` pueden coincidir con ninguno: la entrada se declara como
 * `const <id> = (() => {...})();` en ese mismo ámbito, y la clase que envuelve a todas se llama
 * `pascalCase(this.name())`.
 *
 * **Quien añada un import nuevo a esos emisores, o a la cabecera de `generateLangIndex()`, tiene que
 * añadir aquí el nombre que importa** — si no, un `id` o un nombre de módulo que coincida con ese
 * símbolo nuevo generaría un `index.ts` con dos declaraciones para el mismo nombre, y `validar()` no
 * lo vería venir.
 */
const NOMBRES_RESERVADOS_INDEX = new Set([
    "Module", "Literal", "SingularValue", "PluralValue", "TPluralKey", "pluralBuilder",
    "TranslationMap", "TranslationSet",
]);

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
     * Se comprueba **antes de generar nada**, y por eso existe: lo que valida —que un plural diga cuál de sus
     * parámetros es el contador, que un `id` sea un nombre válido en el `index.ts` que va a declararlo— es un
     * dato que falta o que choca en el `.json`, no un fallo del código generado. Sin esto el hueco se
     * rellenaba solo en tiempo de ejecución (los plurales) o el `index.ts` generado no compilaba, con un
     * error de TypeScript señalando una línea que nadie escribió a mano (los `id` reservados o que chocan).
     *
     * Que un `id` sea un identificador se comprueba con la gramática de ECMAScript (`IDENTIFICADOR`), que
     * admite letras acentuadas: `cerrar_sesión` es válido.
     *
     * @returns Los problemas encontrados, vacío si el módulo está bien.
     */
    public validar(): string[] {
        const items = this.traducciones();
        const donde = (id: string): string => `${this.path()}/${this.name()} › ${id}`;

        const problemas: string[] = items.flatMap(item =>
            problemasDePlural(item).map(problema => `${donde(item.id)}: ${problema}`)
        );

        const pascalModulo = pascalCase(this.name());
        if (NOMBRES_RESERVADOS_INDEX.has(pascalModulo)) {
            problemas.push(`${this.path()}/${this.name()}: el nombre del módulo en PascalCase ("${pascalModulo}") coincide con un nombre que el index.ts generado ya usa en su raíz`);
        }

        // Nombre de tipo generado → ids que lo generan: `XParams` para las que tienen `params` y `XKeys`
        // para los `map`. Se agrupa por el **nombre del tipo** y no por `pascalCase(id)`: un `map` sin
        // params (`FooBarKeys`) y un literal con params (`FooBarParams`) comparten PascalCase pero no
        // generan el mismo nombre, y compilan bien. Lo que choca es que dos entradas generen el mismo
        // tipo: antes de este cambio daba TS2300 al importarlo dos veces en la misma cabecera; ahora el
        // `Set` de imports de `generateLangIndex()` lo dedupica en silencio, así que hay que cazarlo aquí.
        const idsPorTipo = new Map<string, string[]>();
        const anotarTipo = (tipo: string, id: string): void => {
            const ids = idsPorTipo.get(tipo) ?? [];
            ids.push(id);
            idsPorTipo.set(tipo, ids);
        };

        for (const item of items) {
            if (!IDENTIFICADOR.test(item.id)) {
                problemas.push(`${donde(item.id)}: "${item.id}" no es un identificador de JavaScript válido, no puede ser el nombre de la constante que declara el index.ts generado`);
            }
            if (PALABRAS_RESERVADAS.has(item.id)) {
                problemas.push(`${donde(item.id)}: "${item.id}" es palabra reservada de JavaScript, no puede ser el nombre de la constante que declara el index.ts generado`);
            }
            if (NOMBRES_RESERVADOS_INDEX.has(item.id)) {
                problemas.push(`${donde(item.id)}: "${item.id}" coincide con un nombre que el index.ts generado ya usa en su raíz`);
            }
            if (item.id === pascalModulo) {
                problemas.push(`${donde(item.id)}: coincide con el nombre del módulo en PascalCase ("${pascalModulo}"), que el index.ts generado también usa en su raíz`);
            }

            if ((item.params ?? []).length > 0) {
                anotarTipo(`${pascalCase(item.id)}Params`, item.id);
            }
            if (item.tipo === "map") {
                anotarTipo(`${pascalCase(item.id)}Keys`, item.id);
            }
        }

        for (const [tipo, ids] of idsPorTipo) {
            if (ids.length > 1) {
                problemas.push(`${this.path()}/${this.name()}: "${ids.join('", "')}" generan el mismo nombre de tipo (${tipo}) y uno pisa al otro en silencio`);
            }
        }

        return problemas;
    }

    /**
     * Qué es sospechoso pero no seguro, en frases listas para enseñar y ya localizadas en su entrada.
     *
     * Va aparte de `validar()` **a propósito**: eso comprueba datos que faltan y corta la generación; esto
     * adivina intención a partir del texto —si el `counter` declarado es el número con el que concuerda la
     * frase— y solo avisa. Una heurística que rompiese el build por una corazonada sería peor que no tenerla:
     * la primera vez que se equivoca, alguien la desactiva.
     *
     * @returns Los avisos encontrados, vacío si no hay nada que mirar.
     */
    public avisos(): string[] {
        const items = this.traducciones();
        const donde = (id: string, aviso: string): string => `${this.path()}/${this.name()} › ${id}: ${aviso}`;

        return [
            ...items.flatMap(item => avisosDePlural(item).map(aviso => donde(item.id, aviso))),
            // El de idiomas se calcula sobre el módulo entero y no entrada a entrada: lo que detecta es que
            // unas tengan un idioma que a otras les falta, y eso no se puede ver desde una sola.
            ...avisosDeIdioma(items).map(({id, aviso}) => donde(id, aviso)),
        ];
    }

    public moduleLangs(): string[] {
        return Array.from(new Set(this.traducciones().map(jsonItem => Object.keys(jsonItem.values.valor)).flat()));
    }

    /**
     * El `index.ts` de un idioma×módulo, con **todas** las entradas declaradas dentro: ya no hay un fichero
     * por clave (ver `@mr/core/i18n/src/CODEMAP.md` para el porqué). Cada entrada se emite en su propia
     * IIFE, para que sus variables internas —`value`, `literal`, `translationMap`… — no choquen entre sí.
     *
     * @param entradas - Lo que ha emitido cada entrada (`literal.ts`/`map.ts`/`set.ts`), por `id`. Se asume
     *                   que trae una por cada elemento de `traducciones()`: quien la construye
     *                   (`Generate.generateModule()`) ya ha comprobado que todas tienen valor para este
     *                   idioma antes de llegar aquí.
     * @returns El contenido completo del `index.ts` de ese idioma×módulo, listo para `safeWrite()`.
     */
    public generateLangIndex(entradas: Map<string, IEntradaEmitida>): string {

        const simpleTranslations = this.traducciones().filter(t => t.tipo == "literal" && (t.params || []).length == 0);
        const otherTranslations = this.traducciones().filter(t => simpleTranslations.map(st => st.id).indexOf(t.id) == -1);

        const indexLines: string[] = [];

        const dirs = this.config.relativePath.split('/');
        const subDirsCount = dirs.length + 2; // +2 for the <lang> directory and /langs directory

        indexLines.push(`// NO EDITAR A MANO`);
        indexLines.push('');

        // Cabecera: solo el tipo del módulo, y como `type`. Los `XKeys`/`XParams` que antes venían con él
        // llegan ahora por los imports de cada entrada (más abajo); juntarlos aquí también los duplicaría
        // (TS2300), porque cada entrada con params ya importa su propio `XParams` del mismo fichero.
        const moduleImportLine = `import type {${pascalCase(this.name())} as Module} from "${"../".repeat(subDirsCount)}definitions${this.path()}/${this.id}";`;

        // Todas las líneas de import —cabecera y entradas— se deduplican en un único `Set`, conservando el
        // orden de primera aparición: dos entradas que interpolan parámetros del mismo tipo (`ErrorParams`)
        // importarían la misma línea dos veces si no se hiciera aquí.
        const imports = new Set<string>();
        imports.add(moduleImportLine);
        this.traducciones().forEach(translation => {
            const entrada = this.entradaDe(entradas, translation.id);
            entrada.imports.forEach(linea => imports.add(linea));
        });

        indexLines.push(...imports.values());
        indexLines.push('');

        this.traducciones().forEach(translation => {
            const entrada = this.entradaDe(entradas, translation.id);

            indexLines.push(`const ${translation.id} = (() => {`);
            entrada.lineas.forEach(linea => indexLines.push(linea.length > 0 ? `    ${linea}` : ''));
            indexLines.push(`    return ${entrada.expresion};`);
            indexLines.push(`})();`);
            indexLines.push('');
        });

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

    /**
     * La entrada emitida para un `id`, o un error claro si falta.
     *
     * No debería faltar nunca: `Generate.generateModule()` rechaza la generación entera antes de llamar
     * aquí si una entrada se queda sin valor para el idioma que está construyendo. Esto es solo para que,
     * si algún día deja de ser cierto, el fallo señale el módulo y la entrada en vez de un
     * `Cannot read properties of undefined` sin más contexto.
     *
     * @param entradas Lo emitido por cada entrada, por `id` — el mismo mapa que recibe `generateLangIndex()`.
     * @param id       El `id` de la entrada que se busca.
     * @returns La entrada emitida para ese `id`.
     */
    private entradaDe(entradas: Map<string, IEntradaEmitida>, id: string): IEntradaEmitida {
        const entrada = entradas.get(id);
        if (entrada === undefined) {
            throw new Error(`${this.path()}/${this.name()} › ${id}: no se emitió ninguna entrada`);
        }
        return entrada;
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
