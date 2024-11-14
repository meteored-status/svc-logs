import {isDir, isFile, mkdir, readJSON, safeWrite} from "services-comun/modules/utiles/fs";

import {IdiomasLoader} from "./idioma/loader";
import type {IPackageConfig} from "./modulo";
import {ModuloMySQL} from "./modulo/mysql";
import db from "../mysql";

export class Pull {
    /* STATIC */
    public static async run(basedir: string, nuevos: string[] = []): Promise<void> {
        if (!await isFile(`${basedir}/i18n/.credenciales/mysql.json`)) {
            return Promise.reject("No hay credenciales en /i18n/.credenciales/ para descargar las traducciones");
        }

        const {config} = await readJSON<{ config: IPackageConfig }>(`${basedir}/i18n/package.json`);
        const dir = `${basedir}/i18n/.json`;

        const cambio = this.pullCheckModulos(config, nuevos);

        const ids = Object.keys(config.modulos);

        if (!await isDir(dir)) {
            await mkdir(dir, true);
            // } else {
            //     const todos = ids.length==0;
            //     const checks = [...ids];
            //     for (const file of Object.keys(config.modulos)) {
            //         if (!checks.includes(file)) {
            //             if (todos && await isDir(`${dir}/${file}`)) {
            //                 ids.push(file);
            //             } else {
            //                 console.log("Borrando", Colors.colorize([Colors.FgYellow, Colors.Bright],`${dir}/${file}`));
            //                 await unlink(`${dir}/${file}`);
            //             }
            //         }
            //     }
        }

        const idiomas = await IdiomasLoader.fromMySQL();
        const modulosTodos = await Promise.allSettled(ids.filter(id=>!id.includes(".")).map(id => ModuloMySQL.load(id, config, idiomas)));
        const modulos = modulosTodos.filter(modulo => modulo.status=="fulfilled").map(modulo => modulo.value);

        // await Promise.all(modulos.map(modulo => modulo.refreshHash()));
        await safeWrite(`${basedir}/i18n/.json/idiomas.json`, JSON.stringify(idiomas.toJSON(), null, 2));
        await Promise.all([
            ...modulos.map(modulo => modulo.toFile(basedir, config)),
        ]);

        await db.close();

        if (cambio) {
            const paquete = await readJSON(`${basedir}/i18n/package.json`);
            paquete.config = config;
            await safeWrite(`${basedir}/i18n/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
        }
    }

    private static pullCheckModulo(config: IPackageConfig, id: string): boolean {
        let cambio = false;

        const jerarquia = id.split(".");
        let actual = jerarquia.shift()!;
        while (jerarquia.length>0) {
            const nuevo = jerarquia.shift()!;

            const modulo = config.modulos[actual];
            if (modulo==undefined) {
                cambio = true;
                config.modulos[actual] = {
                    include: [nuevo],
                };
            } else {
                if (modulo.exclude!=undefined) {
                    const idx = modulo.exclude.indexOf(nuevo);
                    if (idx>=0) {
                        cambio = true;
                        modulo.exclude.splice(idx, 1);
                    }
                }

                if (modulo.include!=undefined) {
                    if (!modulo.include.includes(nuevo)) {
                        cambio = true;
                        modulo.include.push(nuevo);
                        modulo.include.sort();
                    }
                } else {
                    // todo, aquí tenemos que meter el resto de módulos y valores que ya existían y no se declararon
                }
            }

            actual = `${actual}.${nuevo}`;
        }

        const modulo = config.modulos[actual];
        if (modulo==undefined) {
            cambio = true;
            config.modulos[actual] = {};
        }

        return cambio;
    }

    private static pullCheckModulos(config: IPackageConfig, ids: string[]): boolean {
        let cambio = false;
        for (const id of ids) {
            const ok = this.pullCheckModulo(config, id);
            cambio = cambio || ok;
        }

        if (cambio) {
            const nueva: IPackageConfig = {
                langs: config.langs,
                modulos: {},
            };
            for (const id of Object.keys(config.modulos).sort()) {
                nueva.modulos[id] = config.modulos[id];
            }
            config.modulos = nueva.modulos;
        }

        return cambio;
    }

    /* INSTANCE */
}
