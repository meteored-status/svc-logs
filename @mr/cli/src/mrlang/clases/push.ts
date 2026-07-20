/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 77d0c5427322ccf9ff5d06897189a46e
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {isDir, isFile, readJSON} from "../../utiles/fs";
import {IdiomasLoader} from "./idioma/loader";
import type {IPackageConfig} from "./modulo";
import type {TIdiomas} from "./idioma";
import {ModuloJSON} from "./modulo/json";
import db from "../mysql";

export class Push {
    /* STATIC */
    public static async run(basedir: string): Promise<void> {
        if (!await isFile(`${basedir}/i18n/.credenciales/mysql.json`)) {
            return Promise.reject("No hay credenciales en /i18n/.credenciales/ para subir las traducciones");
        }

        const {config} = await readJSON<{ config: IPackageConfig }>(`${basedir}/i18n/package.json`);
        const jsondir = `${basedir}/i18n/.json`;
        if (!await isDir(jsondir)) {
            console.error("No existe el directorio", jsondir);
            return Promise.reject();
        }

        if (!await isFile(`${jsondir}/idiomas.json`)) {
            return Promise.reject("No hay archivo de idiomas");
        }

        const ids: string[] = Object.keys(config.modulos);

        const idiomas = IdiomasLoader.fromJSON(await readJSON<TIdiomas>(`${jsondir}/idiomas.json`));
        const modulos = await Promise.all(ids.map(id => ModuloJSON.load(jsondir, id, idiomas, config)));

        await Promise.all(modulos.map(modulo => modulo.preparePush()));
        await Promise.all(modulos.map(modulo => modulo.toMySQL()));

        // console.log(modulos.map(modulo => modulo.print()));
        await db.close();
    }

    /* INSTANCE */
}
