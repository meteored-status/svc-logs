import chokidar from "chokidar";

import {isDir, mkdir, readDir, rmdir, safeWrite, unlink} from "services-comun/modules/utiles/fs";

import {JSONItemLiteral, JSONItemMap, JSONItemSet} from "./data";
import {ModuloJSON} from "./modulo/json";
import generateLiteral from "./modulo/translation/literal";
import generateMap from "./modulo/translation/map";
import generateSet from "./modulo/translation/set";
import {Definition} from "./modulo/definition";
import {info} from "services-comun/modules/utiles/log";

export class Generate {
    /* STATIC */
    public static async run(basedir: string, watch: boolean): Promise<void> {

        const jsondir = `${basedir}/i18n/.json`;
        const classdir = `${basedir}/i18n`;
        if (!await isDir(jsondir)) {
            console.error("No existe el directorio", jsondir);
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

        info(`Generating translations in ${langsDir}`);
        const modulos = await this.loadModule(jsondir, langsDir, definitionsDir, watch);

        for (const modulo of modulos) {
            await this.generateModule(modulo, langsDir, definitionsDir);
        }
        if (watch) {
            info(`Watching for changes in ${jsondir}`);
        }
    }

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
                        const valor = literal.values.valor[lang]??literal.values.defecto;

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
        await safeWrite(definition.path(), definition.content(), true);
    }

    /* INSTANCE */
}
