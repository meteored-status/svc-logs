/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: c410854c3953a8565be6b199f7ba86ef
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Colors} from "@mr/core-cli/colors";

import {isDir, isFile, mkdir, readDir, readJSON, rmdir, safeWrite} from "@mr/core-cli/fs";
import {IdiomasLoader} from "./idioma/loader";
import type {IPackageConfig} from "./modulo";
import type {TIdiomas} from "./idioma";
import {ModuloJSON} from "./modulo/json";
import loaderLangs from "./modulo/tmpl/langs";
import loader from "./modulo/tmpl/loader";
import loaderBundle from "./modulo/tmpl/loader-bundle";
import loaderLangTMPL from "./modulo/tmpl/loader-lang";
import loaderLangBundleTMPL from "./modulo/tmpl/loader-lang-bundle";

export class Generate {
    /* STATIC */
    public static async run(basedir: string, watch: boolean): Promise<void> {
        const {config} = await readJSON<{ config: IPackageConfig }>(`${basedir}/i18n/package.json`);
        const jsondir = `${basedir}/i18n/.json`;
        const classdir = `${basedir}/i18n`;
        if (!await isDir(jsondir)) {
            console.error("No existe el directorio", jsondir);
            return Promise.reject();
        }
        if (!await isFile(`${jsondir}/idiomas.json`)) {
            return Promise.reject("No hay archivo de idiomas");
        }

        //aquí limpiamos los archivos generados anteriormente
        if (await isDir(`${classdir}/.src`)) {
            await rmdir(`${classdir}/.src`);
        }
        // Lista blanca: lo que no esta aqui se **borra**. `.credenciales` sigue dentro aunque ya no se
        // use —guardaba el `mysql.json` del generador v1, que se retiro con todo MySQL el 2026-09-04—
        // porque quitarlo convertiria esta linea en un borrado de credenciales reales en cualquier
        // repo que todavia las tenga. `init` ya no crea el directorio; el que exista, se respeta.
        const validas = [".credenciales", ".json", ".run", "package.json", "tsconfig.json"];
        for (const file of await readDir(classdir)) {
            if (!validas.includes(file)) {
                await rmdir(`${classdir}/${file}`);
            }
        }
        await mkdir(`${classdir}/.src`);

        const moduloIDs = Object.keys(config.modulos).filter(id => !id.includes("."));

        const idiomas = IdiomasLoader.fromJSON(await readJSON<TIdiomas>(`${jsondir}/idiomas.json`));
        if (config.lang!=undefined && !config.langs.includes(config.lang)) {
            config.langs.push(config.lang);
        }
        config.langs.sort();

        const modulos = await Promise.all(moduloIDs.map(id => ModuloJSON.load(jsondir, id, idiomas, config)));

        //loaderLangs
        const langs: Record<string, Record<string, string[]>> = {};
        for (const modulo of modulos) {
            langs[modulo.id] = await modulo.regenerar(classdir);
        }
        const mapping = this.generarMapping(langs, modulos.length);

        const promesas: Promise<boolean>[] = [
            safeWrite(`${classdir}/langs.ts`, loaderLangs({lang: config.lang, langs: config.langs}), true),
            safeWrite(`${classdir}/index.ts`, loader({modulos, lang: config.lang, mapping}), true),
            safeWrite(`${classdir}/bundle.ts`, loaderBundle({modulos, lang: config.lang, langs: config.langs, mapping}), true),
        ];

        const procesados: string[] = [];
        for (const lang of config.langs) {
            const idioma = mapping[lang]==undefined ? lang : mapping[lang];
            if (procesados.includes(idioma)) {
                continue;
            }
            await mkdir(`${classdir}/.src/${idioma.replace("-", "")}`);
            promesas.push(
                safeWrite(`${classdir}/.src/${idioma.replace("-", "")}/index.ts`, loaderLangTMPL({lang: idioma, modulos, langs}), true),
                safeWrite(`${classdir}/.src/${idioma.replace("-", "")}/bundle.ts`, loaderLangBundleTMPL({lang: idioma, modulos, langs}), true),
            );
        }
        await Promise.all(promesas);

        if (watch) {
            console.log("Iniciando generación de idiomas =>", `[${Colors.colorize([Colors.FgGreen], "OK")}]`)
            idiomas.addWatch(jsondir);
            for (const modulo of modulos) {
                modulo.addWatch(classdir);
            }
        }
    }

    private static generarMapping(modulos: Record<string, Record<string, string[]>>, cantidad: number): Record<string, string> {
        const cantidades: Record<string, {
            lang: string;
            modulos: string[];
        }> = {};
        for (const modulo of Object.keys(modulos)) {
            for (const lang of Object.keys(modulos[modulo])) {
                if (!modulos[modulo][lang].includes(lang)) {
                    for (const idioma of modulos[modulo][lang]) {
                        cantidades[idioma] ??= {
                            lang,
                            modulos: [],
                        };
                        cantidades[idioma].modulos.push(modulo);
                    }
                }
            }
        }
        const mapping: Record<string, string> = {};
        for (const lang of Object.keys(cantidades)) {
            if (cantidades[lang].modulos.length==cantidad) {
                mapping[lang] = cantidades[lang].lang;
            }
        }

        return mapping;
    }

    /* INSTANCE */
}
