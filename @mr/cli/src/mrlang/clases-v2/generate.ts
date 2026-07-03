/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 25 Jun 2026 06:52:42 GMT
 * Hash: 8f6755ad166db9e083afd8dfd2d01632
 * Versión: 2026.6.25+5-josantoniojimnez
 * Anterior: 2026.6.25+4-josantoniojimnez
 */

import chokidar from "chokidar";

import {isDir, mkdir, readDir, rmdir, safeWrite, unlink} from "services-comun/modules/utiles/fs";
import {error, info} from "services-comun/modules/utiles/log";

import {JSONItemLiteral, JSONItemMap, JSONItemSet, JSONValue} from "./data";
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

        //aquí limpiamos los archivos generados anteriormente
        if (await isDir(`${classdir}/.src`)) {
            await rmdir(`${classdir}/.src`);
        }

        const sourceDir = `${classdir}/.src`;
        const langsDir = `${sourceDir}/langs`;
        const definitionsDir = `${sourceDir}/definitions`;

        await mkdir(sourceDir, true);
        await mkdir(langsDir, true);
        await mkdir(definitionsDir, true);

        const modulos = await this.loadModule(jsondir, langsDir, definitionsDir, watch);

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
            await mkdir(moduleDir, true);
            const indexFileName = `${moduleDir}/index.ts`;

            for (const jsonItem of jsonItems) {
                const fileName = `${moduleDir}/${jsonItem.id}.ts`;

                switch (jsonItem.tipo) {
                    case "literal":
                        const literal = jsonItem as JSONItemLiteral;
                        let valor: JSONValue | undefined = undefined;
                        let currentLang: Lang | null = await Lang.getByCode(lang);
                        // Busca primero en el idioma solicitado y sube por su jerarquía.
                        while (currentLang && !valor) {
                            valor = literal.values.valor[currentLang.code];
                            if (!valor) {
                                currentLang = await currentLang.parent;
                            }
                        }
                        if (!valor) {
                            valor = literal.values.defecto;
                        }

                        if (valor) {
                            const content = generateLiteral(lang, valor, literal, modulo, definition);
                            await safeWrite(fileName, content, true);
                        }
                        break;

                    case "map":
                        const map = jsonItem as JSONItemMap;
                        const valorMap = (map.values.valor[lang]??map.values.defecto);
                        if (valorMap) {
                            const content = generateMap(lang, valorMap, map, modulo, definition);
                            await safeWrite(fileName, content, true);
                        }
                        break;
                    case "set":
                        const set = jsonItem as JSONItemSet;
                        const valorSet = (set.values.valor[lang]??set.values.defecto);
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

        await mkdir(definition.dir(), true)
        await safeWrite(`${definition.dir()}/index.ts`, definition.index(), true);
        await safeWrite(`${definition.dir()}/bundle.ts`, definition.bundle(), true);
    }

    /* INSTANCE */
}
