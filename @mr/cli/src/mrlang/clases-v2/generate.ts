/**
 * Editor: Bixus
 * Fecha: Wed, 02 Sep 2026 14:49:28 GMT
 * Hash: 12c5da90ff0af98380eb50b781ad868a
 * Versión: 2026.9.2+2-bixus
 * Anterior: 2026.9.2+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import chokidar from "chokidar";

import {isDir, mkdir, readDir, rmdir, safeWrite, unlink} from "../../utiles/fs";
import {error, info} from "../../utiles/log";
import {JSONItemLiteral, JSONItemMap, JSONItemSet, JSONValor} from "./data";
import {Lang} from "./lang/lang.ts";
import {ModuloJSON} from "./modulo/json";
import {Definition} from "./modulo/definition";
import generateLiteral from "./modulo/translation/literal";
import generateMap from "./modulo/translation/map";
import generateSet from "./modulo/translation/set";

/**
 * Genera los artefactos TypeScript de i18n a partir de los JSON fuente.
 */
export class Generate {
    /* STATIC */

    /**
     * Ejecuta la generación completa de módulos y, opcionalmente, activa watch.
     *
     * @param basedir - Directorio raíz del workspace.
     * @param watch - Si es `true`, observa cambios en los JSON de idioma.
     */
    public static async run(basedir: string, watch: boolean): Promise<void> {

        const jsondir = `${basedir}/i18n/.json`;
        const classdir = `${basedir}/i18n`;
        if (!await isDir(jsondir)) {
            error("No existe el directorio", jsondir);
            return Promise.reject();
        }

        const sourceDir = `${classdir}/.src`;
        const langsDir = `${sourceDir}/langs`;
        const definitionsDir = `${sourceDir}/definitions`;

        // Se leen los JSON **antes** de tocar el `.src`: si alguno está mal escrito, lo que había sigue en su
        // sitio en vez de quedarse el workspace sin generar por un error de una sola entrada.
        const modulos = await this.loadModule(jsondir, langsDir, definitionsDir, watch);

        const problemas = modulos.flatMap(modulo => modulo.validar());
        if (problemas.length > 0) {
            for (const problema of problemas) {
                error(problema);
            }
            return Promise.reject(`${problemas.length} ${problemas.length == 1 ? "entrada mal escrita" : "entradas mal escritas"}; no se ha generado nada`);
        }

        //aquí limpiamos los archivos generados anteriormente
        if (await isDir(`${classdir}/.src`)) {
            await rmdir(`${classdir}/.src`);
        }

        await mkdir(sourceDir);
        await mkdir(langsDir);
        await mkdir(definitionsDir);

        for (const modulo of modulos) {
            await this.generateModule(modulo, langsDir, definitionsDir);
        }
        if (watch) {
            info(`Watching for changes in ${jsondir}`);
        }
    }

    /**
     * Carga recursivamente los módulos JSON y configura watchers cuando aplica.
     *
     * @param basedir - Directorio base a escanear.
     * @param langsDir - Directorio de salida para idiomas.
     * @param definitionsDir - Directorio de salida para definiciones.
     * @param watch - Si debe activar observadores de cambios.
     */
    private static async loadModule(basedir: string, langsDir: string, definitionsDir: string, watch: boolean): Promise<ModuloJSON[]> {
        const files = await readDir(basedir);

        const modulos: ModuloJSON[] = [];

        for (const file of files) {
            if (await isDir(`${basedir}/${file}`)) {
                modulos.push(...await this.loadModule(`${basedir}/${file}`, langsDir, definitionsDir, watch));
            } else if (file.endsWith(".json")) {
                const modulo = await ModuloJSON.load(basedir, file);
                modulos.push(modulo);

                if (watch) {
                    const watcher = chokidar.watch(`${basedir}/${file}`, {persistent: true});
                    watcher.on("change", async () => {
                        info(`Module ${modulo.name()} has been changed`);
                        for (const langs of await readDir(`${langsDir}`)) {
                            if (await isDir(`${langsDir}/${langs}`)) {
                                await unlink(`${langsDir}/${langs}${modulo.path()}`);
                            }
                        }
                        await this.generateModule(await ModuloJSON.load(basedir, file), langsDir, definitionsDir);
                    });
                }
            }
        }

        return modulos;
    }

    /**
     * El valor de una entrada para un idioma, **subiendo por la jerarquía** del catálogo antes de rendirse al
     * defecto: `es-ES` mira `es`, luego `en`, luego `en-US`.
     *
     * Está aquí y no repetido en cada `case` porque **solo lo hacían los literales**. Un `map` o un `set`
     * resolvían con `valor[lang] ?? defecto`, así que se saltaban la herencia entera. Hoy no se distinguía
     * —el defecto de estos módulos es inglés y la cadena de `es` acaba en inglés—, pero al añadir un idioma
     * cuyo padre no sea el defecto, un `es-MX` caería a `es` en los literales y al inglés en el mapa de la
     * misma pantalla.
     *
     * @param valores Valores por código de idioma, tal como vienen del `.json`.
     * @param defecto El valor de respaldo de la entrada, si lo declara.
     * @param lang    Idioma que se está generando.
     * @returns El valor a usar, o `undefined` si la entrada no tiene nada que ofrecer para ese idioma.
     */
    private static async resolverValor<T extends JSONValor>(valores: Record<string, T>, defecto: T|undefined, lang: string): Promise<T|undefined> {
        let actual: Lang|null = await Lang.getByCode(lang);

        while (actual != null) {
            const valor = valores[actual.code];
            if (valor != undefined) {
                return valor;
            }
            actual = await actual.parent;
        }

        return defecto;
    }

    /**
     * Genera los ficheros de un módulo para todos sus idiomas disponibles.
     *
     * @param modulo - Módulo de traducciones cargado desde JSON.
     * @param langsDir - Directorio de salida para idiomas.
     * @param definitionsDir - Directorio de salida para definiciones compartidas.
     */
    private static async generateModule(modulo: ModuloJSON, langsDir: string, definitionsDir: string): Promise<void> {

        const moduleLangs = modulo.moduleLangs();
        const jsonItems = modulo.traducciones();

        const definition = new Definition(modulo.id, definitionsDir, modulo.path(), moduleLangs);

        for (const lang of moduleLangs) {

            const langdir = `${langsDir}/${lang.replace("-", "")}`;
            const moduleDir = `${langdir}${modulo.path()}/${modulo.name()}`;
            await mkdir(moduleDir);
            const indexFileName = `${moduleDir}/index.ts`;

            for (const jsonItem of jsonItems) {
                const fileName = `${moduleDir}/${jsonItem.id}.ts`;

                switch (jsonItem.tipo) {
                    case "literal":
                        const literal = jsonItem as JSONItemLiteral;
                        const valor = await this.resolverValor(literal.values.valor, literal.values.defecto, lang);

                        if (valor) {
                            const content = generateLiteral(lang, valor, literal, modulo, definition);
                            await safeWrite(fileName, content, true);
                        }
                        break;

                    case "map":
                        const map = jsonItem as JSONItemMap;
                        const valorMap = await this.resolverValor(map.values.valor, map.values.defecto, lang);
                        if (valorMap) {
                            const content = generateMap(lang, valorMap, map, modulo, definition);
                            await safeWrite(fileName, content, true);
                        }
                        break;
                    case "set":
                        const set = jsonItem as JSONItemSet;
                        const valorSet = await this.resolverValor(set.values.valor, set.values.defecto, lang);
                        if (valorSet) {
                            const content = generateSet(lang, valorSet, set, modulo, definition);
                            await safeWrite(fileName, content, true);
                        }
                        break;
                }
            }

            await safeWrite(indexFileName, modulo.generateLangIndex(), true);
            definition.moduleInterface = modulo.generateIndex();
        }

        await mkdir(definition.dir())
        await safeWrite(`${definition.dir()}/index.ts`, definition.index(), true);
        await safeWrite(`${definition.dir()}/bundle.ts`, definition.bundle(), true);
    }

    /* INSTANCE */
}
