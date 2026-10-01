/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 28 Sep 2026 06:38:15 GMT
 * Hash: 15f04e4925e1ca1ff1d42f71dc0c0e09
 * Versión: 2026.9.28+1-juancmartinez
 * Anterior: 2026.9.23+1-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-panel-frontend.git
 */

import chokidar from "chokidar";
import path from "node:path";

import {isDir, mkdir, readDir, rmdir, safeWrite, unlink} from "@mr/core-cli/fs";
import {error, info, warning} from "@mr/core-cli/log";

import {flattenLang} from "../../modules/util/lang";
import type {JSONItemLiteral, JSONItemMap, JSONItemSet, JSONValor} from "./data";
import {Lang} from "./lang/lang.ts";
import {ModuloJSON} from "./modulo/json";
import {Definition} from "./modulo/definition";
import type {IEntradaEmitida} from "./modulo/translation/common";
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

        // `validar()` y `problemasDeValor()` se juntan **antes** de escribir nada. Separados, un módulo con
        // una entrada sin valor pasaba `validar()`, `generateModule()` escribía el `index.ts` de los idiomas
        // anteriores a esa entrada y rechazaba a mitad — dejando en `.src` un `index.ts` de un idioma que
        // importa un `XParams` que `definitions/` de ese módulo todavía no exporta (se reescribe una sola vez,
        // al final de todos los idiomas). Aquí ningún módulo con problemas llega a `generateModule()`.
        const problemas = modulos.flatMap(modulo => [...modulo.validar(), ...this.problemasDeValor(modulo)]);
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
        // **anterior**, que compila — con una salvedad, y es de este módulo: dentro de un mismo
        // módulo, el `index.ts` de cada idioma se escribe **antes** que su `definitions/`, que se
        // reescribe una sola vez al final con los tipos de todos los idiomas ya vistos (ver
        // `generateModule()`). Entre esos dos `await` hay una ventana en la que un `index.ts` recién
        // escrito puede importar un `XParams` que `definitions/` todavía no exporta. La pasada previa
        // de `validar()` + `problemasDeValor()`, arriba, evita el caso que antes se colaba a mitad de
        // `generateModule()` —una entrada sin valor dejaba escritos varios `index.ts` antes de
        // rechazar—, pero no esta ventana, más estrecha y del mismo módulo consigo mismo.
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
                        // Un `.on("change", ...)` de chokidar no tiene quien espere su promesa: si el cuerpo
                        // rechaza, es un `unhandledRejection` que mata el proceso entero del watch por un
                        // `.json` mal escrito. Todo el cuerpo va en `try/catch` y lo que antes rechazaba ahora
                        // se registra con `error()` y termina ahí, sin tumbar nada más.
                        try {
                            info(`Module ${modulo.name()} has been changed`);
                            const modificado = await ModuloJSON.load(basedir, file);

                            // Se valida **antes de tocar el disco**, igual que en `run()`: si el `.json` que se
                            // acaba de guardar tiene un problema, se avisa y no se escribe nada — ni encima de
                            // lo que ya había.
                            const problemas = [...modificado.validar(), ...this.problemasDeValor(modificado)];
                            if (problemas.length > 0) {
                                for (const problema of problemas) {
                                    error(problema);
                                }
                                return;
                            }

                            // `generateModule()` sobrescribe todo lo que este módulo tiene para sus idiomas
                            // actuales — ya no hace falta borrar nada antes de regenerar (un `index.ts` por
                            // idioma×módulo, no un fichero por clave). Lo que **no** sobrescribe es un idioma
                            // que el módulo tenía y ha dejado de tener: eso se poda aparte, después.
                            const langsRetirados = new Set(await readDir(langsDir));
                            for (const lang of modificado.moduleLangs()) {
                                langsRetirados.delete(flattenLang(lang));
                            }
                            await this.generateModule(modificado, langsDir, definitionsDir);

                            // La poda es **solo** el directorio de este módulo dentro del idioma retirado
                            // (`<lang>${modulo.path()}/${modulo.name()}`), nunca `<lang>${modulo.path()}`: ese
                            // es el directorio del **grupo** (p. ej. `/pages`) y puede tener otros módulos
                            // hermanos dentro. Es justo el fallo que tenía el `unlink()` de aquí antes de este
                            // cambio —preexistente, no de esta tarea—: `unlink()` borra directorios en
                            // recursivo (ver `@mr/core/cli/modules/fs.ts::unlink`), así que un `.json`
                            // cualquiera que cambiara se llevaba **todos** los módulos hermanos de **todos**
                            // los idiomas, y `generateModule()` solo regeneraba el que había cambiado.
                            for (const lang of langsRetirados) {
                                const moduleDir = `${langsDir}/${lang}${modificado.path()}/${modificado.name()}`;
                                if (await isDir(moduleDir)) {
                                    await unlink(moduleDir);
                                }
                            }
                        } catch (e) {
                            error(`Error regenerando el módulo ${modulo.name()} tras su cambio`, e);
                        }
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
    private static resolverValor<T extends JSONValor>(valores: Record<string, T>, defecto: T|undefined, lang: string): T|undefined {
        // **Lo declarado a mano gana siempre, lo conozca el catálogo o no.** La búsqueda de abajo entra por
        // `Lang.getByCode()`, que a un código que no está en el catálogo le devuelve `en-US` sin decirlo, así
        // que la vuelta siguiente ya no busca el idioma pedido sino el inglés. Con los códigos de siempre da
        // igual —están todos—, pero un `ca-ES-valencia` escrito en el `.json`, con su valor al lado, salía
        // generado en inglés: el bucle no llegaba a mirar su clave.
        const propio = valores[lang];
        if (propio != undefined) {
            return propio;
        }

        let actual: Lang|null = Lang.getByCode(lang);

        while (actual != null) {
            const valor = valores[actual.code];
            if (valor != undefined) {
                return valor;
            }
            actual = actual.parent;
        }

        return defecto;
    }

    /**
     * Qué entradas del módulo se quedan sin valor para alguno de sus idiomas —ni propio, ni heredado
     * por `resolverValor()`, ni `defecto`—, en el mismo formato de mensaje que usaba (y sigue usando,
     * como defensa) el rechazo de en medio de `generateModule()`.
     *
     * Va en la misma pasada previa que `validar()`, antes de escribir nada: por separado, un módulo
     * con esta única mancha pasaba `validar()`, `generateModule()` llegaba a escribir el `index.ts`
     * de los idiomas anteriores a la entrada mala y rechazaba a mitad, dejando en `.src` ficheros a
     * medio generar.
     *
     * @param modulo Módulo ya cargado del `.json`.
     * @returns Los problemas encontrados, vacío si todas las entradas tienen valor en todos los
     *          idiomas del módulo.
     */
    private static problemasDeValor(modulo: ModuloJSON): string[] {
        const problemas: string[] = [];
        const moduleLangs = modulo.moduleLangs();

        for (const jsonItem of modulo.traducciones()) {
            for (const lang of moduleLangs) {
                const valor = this.resolverValor(jsonItem.values.valor, jsonItem.values.defecto, lang);
                if (valor === undefined || valor === null) {
                    problemas.push(`${modulo.path()}/${modulo.name()} › ${jsonItem.id}: sin valor para el idioma "${lang}"`);
                }
            }
        }

        return problemas;
    }

    /**
     * Genera los ficheros de un módulo para todos sus idiomas disponibles.
     *
     * @param modulo - Módulo de traducciones cargado desde JSON.
     * @param langsDir - Directorio de salida para idiomas.
     * @param definitionsDir - Directorio de salida para definiciones compartidas.
     * @returns Las rutas que ha escrito, que es con lo que `run()` decide qué sobra en `.src`. Quien
     *          lo llama desde el watch las ignora: ahí no se poda con `limpiarHuerfanos()`, solo se
     *          reescribe el módulo que ha cambiado (y se podan aparte sus idiomas retirados, ver
     *          `loadModule()`).
     */
    private static async generateModule(modulo: ModuloJSON, langsDir: string, definitionsDir: string): Promise<string[]> {
        const escritos: string[] = [];

        const moduleLangs = modulo.moduleLangs();
        const jsonItems = modulo.traducciones();

        const definition = new Definition(modulo.id, definitionsDir, modulo.path(), moduleLangs);

        for (const lang of moduleLangs) {

            const langdir = `${langsDir}/${flattenLang(lang)}`;
            const moduleDir = `${langdir}${modulo.path()}/${modulo.name()}`;
            await mkdir(moduleDir);
            const indexFileName = `${moduleDir}/index.ts`;

            // Una entrada por `id`, para que `generateLangIndex()` las coloque todas dentro del mismo
            // `index.ts` — ya no un fichero por clave, ver `@mr/core/i18n/src/CODEMAP.md`.
            const entradas = new Map<string, IEntradaEmitida>();

            for (const jsonItem of jsonItems) {
                switch (jsonItem.tipo) {
                    case "literal": {
                        const literal = jsonItem as JSONItemLiteral;
                        const valor = this.resolverValor(literal.values.valor, literal.values.defecto, lang);

                        if (valor === undefined || valor === null) {
                            return Promise.reject(`${modulo.path()}/${modulo.name()} › ${literal.id}: sin valor para el idioma "${lang}"`);
                        }
                        entradas.set(literal.id, generateLiteral(lang, valor, literal, modulo, definition));
                        break;
                    }
                    case "map": {
                        const map = jsonItem as JSONItemMap;
                        const valorMap = this.resolverValor(map.values.valor, map.values.defecto, lang);
                        if (valorMap === undefined || valorMap === null) {
                            return Promise.reject(`${modulo.path()}/${modulo.name()} › ${map.id}: sin valor para el idioma "${lang}"`);
                        }
                        entradas.set(map.id, generateMap(lang, valorMap, map, modulo, definition));
                        break;
                    }
                    case "set": {
                        const set = jsonItem as JSONItemSet;
                        const valorSet = this.resolverValor(set.values.valor, set.values.defecto, lang);
                        if (valorSet === undefined || valorSet === null) {
                            return Promise.reject(`${modulo.path()}/${modulo.name()} › ${set.id}: sin valor para el idioma "${lang}"`);
                        }
                        entradas.set(set.id, generateSet(lang, valorSet, set, modulo, definition));
                        break;
                    }
                }
            }

            await safeWrite(indexFileName, modulo.generateLangIndex(entradas), true);
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
