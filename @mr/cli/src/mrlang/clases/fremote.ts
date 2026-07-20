/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 2d85ac47549f91e63d9cb7ce3356cc6d
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {isFile, readJSON} from "../../utiles/fs";
import {IdiomasLoader} from "./idioma/loader";
import type {IPackageConfig} from "./modulo";
import {ModuloMySQL} from "./modulo/mysql";
import db from "../mysql";

export class FixRemote {
    /* STATIC */
    public static async run(basedir: string, ids?: string[]): Promise<void> {
        if (!await isFile(`${basedir}/i18n/.credenciales/mysql.json`)) {
            return Promise.reject("No hay credenciales en /i18n/.credenciales/ para corregir las traducciones remotas");
        }

        const {config} = await readJSON<{ config: IPackageConfig }>(`${basedir}/i18n/package.json`);
        const idiomas = await IdiomasLoader.fromMySQL();
        if (ids==undefined) {
            ids = await ModuloMySQL.getIDS();
        }
        const modulos = await Promise.all(ids.map(id => ModuloMySQL.load(id, config, idiomas)));

        await Promise.all(modulos.map(modulo => modulo.refreshHash()));
        await Promise.all(modulos.map(modulo => modulo.fixVersion()));

        await db.close();
    }

    /* INSTANCE */
}
