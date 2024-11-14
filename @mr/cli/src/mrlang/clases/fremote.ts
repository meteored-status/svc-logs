import {isFile} from "services-comun/modules/utiles/fs";
import {readJSON} from "services-comun/modules/utiles/fs";

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
