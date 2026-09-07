/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: f5bacef0b48bba7ede9a5526f89e1ea8
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.9.3+4-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import chokidar from "chokidar";
import path from "node:path";

import {isDir, mkdir, readDir, rmdir, safeWrite, unlink} from "@mr/core-cli/fs";
import {error, info, warning} from "@mr/core-cli/log";
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

        // Los avisos se enseñan **después** de comprobar los errores y **no** cortan: son heurísticos, y lo
        // que dicen puede estar bien escrito aposta. Se imprimen aquí, con el módulo y la entrada, para que
        // quien acaba de tocar el `.json` los vea en el mismo sitio donde vería un error.
        for (const aviso of modulos.flatMap(modulo => modulo.avisos())) {
            warning(aviso);
        }

        await mkdir(sourceDir);
        await mkdir(langsDir);
        await mkdir(definitionsDir);

        // **`.src` no se borra antes de generar**, se genera encima y al final se quita lo que ya no
        // toca. Antes se borraba en bloque, y eso deja el directorio incompleto durante todo lo que
        // tarde la generación: cualquiera que compile en ese hueco —un `tsc`, el `next dev` de otra
        // terminal, otra sesión— se encuentra decenas de «Cannot find module» sobre ficheros que
        // existían hace un segundo y van a volver a existir. Pasó de verdad y cuesta un rato
        // entenderlo, porque el error no señala a quien lo provocó.
        //
        // Generando encima, lo peor que puede ver quien lea a la vez es un fichero con el contenido
        // **anterior**, que compila. Y el orden de escritura ya lo hacía posible sin saberlo:
        // `generateModule()` escribe las claves de un idioma antes que su `index.ts`, así que un
        // índice nunca apunta a un fichero que todavía no está.
        const escritos = new Set<string>();
        for (const modulo of modulos) {
            for (const fichero of await this.generateModule(modulo, langsDir, definitionsDir)) {
                escritos.add(path.resolve(fichero));
            }
        }
        await this.limpiarHuerfanos(sourceDir, escritos);
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
    /**
     * Genera los ficheros de un módulo.
     *
     * @returns Las rutas que ha escrito, que es con lo que `run()` decide qué sobra en `.src`. Quien
     *          lo llama desde el watch las ignora: ahí no se poda nada, solo se reescribe el módulo
     *          que ha cambiado.
     */
    private static async generateModule(modulo: ModuloJSON, langsDir: string, definitionsDir: string): Promise<string[]> {
        const escritos: string[] = [];

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
                            escritos.push(fileName);
                        }
                        break;

                    case "map":
                        const map = jsonItem as JSONItemMap;
                        const valorMap = await this.resolverValor(map.values.valor, map.values.defecto, lang);
                        if (valorMap) {
                            const content = generateMap(lang, valorMap, map, modulo, definition);
                            await safeWrite(fileName, content, true);
                            escritos.push(fileName);
                        }
                        break;
                    case "set":
                        const set = jsonItem as JSONItemSet;
                        const valorSet = await this.resolverValor(set.values.valor, set.values.defecto, lang);
                        if (valorSet) {
                            const content = generateSet(lang, valorSet, set, modulo, definition);
                            await safeWrite(fileName, content, true);
                            escritos.push(fileName);
                        }
                        break;
                }
            }

            await safeWrite(indexFileName, modulo.generateLangIndex(), true);
            escritos.push(indexFileName);
            definition.moduleInterface = modulo.generateIndex();
        }

        await mkdir(definition.dir())
        await safeWrite(`${definition.dir()}/index.ts`, definition.index(), true);
        await safeWrite(`${definition.dir()}/bundle.ts`, definition.bundle(), true);
        escritos.push(`${definition.dir()}/index.ts`, `${definition.dir()}/bundle.ts`);

        return escritos;
    }

    /**
     * Quita de `.src` lo que ya no genera ningún módulo: una entrada borrada del `.json`, un idioma
     * retirado, un módulo entero que ya no existe.
     *
     * Va **al final** y no al principio, que es lo que permite que el directorio esté completo en
     * todo momento. El orden de dentro también importa: primero los ficheros y después los
     * directorios de más profundo a menos, para que uno que se queda vacío al borrar sus hijos se
     * vaya en la misma pasada.
     *
     * @param sourceDir Raíz de lo generado (`i18n/.src`).
     * @param escritos  Rutas absolutas que la generación acaba de escribir.
     */
    private static async limpiarHuerfanos(sourceDir: string, escritos: Set<string>): Promise<void> {
        if (!await isDir(sourceDir)) {
            return;
        }

        const entradas = await readDir(sourceDir, {recursive: true, withFileTypes: true});
        const directorios: string[] = [];
        for (const entrada of entradas) {
            const ruta = path.resolve(entrada.parentPath, entrada.name);
            if (entrada.isDirectory()) {
                directorios.push(ruta);
                continue;
            }
            if (!escritos.has(ruta)) {
                await unlink(ruta);
            }
        }

        directorios.sort((uno, otro) => otro.length-uno.length);
        for (const directorio of directorios) {
            if ((await readDir(directorio)).length == 0) {
                await rmdir(directorio);
            }
        }
    }

    /* INSTANCE */
}
