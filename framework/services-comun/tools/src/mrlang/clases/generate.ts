import {isDir, isFile, mkdir, readDir, readJSON, rmdir, safeWrite} from "services-comun/modules/utiles/fs";

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
        const validas = [".credenciales", ".json", ".run", "package.json", "tsconfig.json"];
        for (const file of await readDir(classdir)) {
            if (!validas.includes(file)) {
                await rmdir(`${classdir}/${file}`);
            }
        }
        await mkdir(`${classdir}/.src`, true);

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
            promesas.push(
                safeWrite(`${classdir}/.src/${idioma.replace("-", "")}/index.ts`, loaderLangTMPL({lang: idioma, modulos, langs}), true),
                safeWrite(`${classdir}/.src/${idioma.replace("-", "")}/bundle.ts`, loaderLangBundleTMPL({lang: idioma, modulos, langs}), true),
            );
        }
        await Promise.all(promesas);

        if (watch) {
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
