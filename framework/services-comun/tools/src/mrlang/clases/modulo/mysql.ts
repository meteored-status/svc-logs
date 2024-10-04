import {Colors} from "services-comun/tools/src/mrpack/clases/colors";
import {readDir, unlink} from "services-comun/modules/utiles/fs";

import type {Idiomas, TIdiomas} from "../idioma";
import {IdiomasLoader} from "../idioma/loader";
import {type IModuloConfig as IModuloConfigBase, type IPackageConfig, Modulo} from "./";
import {ModuloJSON} from "./json";
import type {Traduccion} from "./traduccion/loader";
import {TraduccionLoaderMySQL} from "./traduccion/loader/mysql";
import db from "../../mysql";

interface IModuloMySQL {
    id: string;
    padre: string|null;
    borrado: number;
    descripcion: string;
    idiomas: TIdiomas|null;
    version: Date;
    hash: string;
}

interface IModuloConfig extends IModuloConfigBase {
    config: IPackageConfig;
}

export class ModuloMySQL extends Modulo<IModuloConfig> {
    /* STATIC */
    public static async getIDS(): Promise<string[]> {
        const rows = await db.query<{ id: string }>("SELECT `id` FROM `modulos` WHERE `padre` IS NULL AND borrado=0 ORDER BY id");

        return rows.map(row => row.id);
    }

    public static async load(id: string, paquete: IPackageConfig, idiomas?: Idiomas): Promise<ModuloMySQL> {
        const [
            [row],
            langs,
        ] = await Promise.all([
            db.query<IModuloMySQL>("SELECT * FROM `modulos` WHERE id=? AND borrado=0", [id]),
            idiomas!=undefined ? Promise.resolve(idiomas) : IdiomasLoader.fromMySQL(),
        ]);

        if (row==undefined) {
            return Promise.reject(`No existe el modulo ${id}`);
        }

        return await this.build(row, langs, paquete);
    }

    protected static async loadPadre(padre: string, idiomas: Idiomas, paquete: IPackageConfig): Promise<ModuloMySQL[]> {
        const rows = await db.query<IModuloMySQL>("SELECT * FROM `modulos` WHERE padre=? AND borrado=0 ORDER BY id", [padre]);

        return await Promise.all(rows.map(row => this.build(row, idiomas, paquete)));
    }

    public static async build(row: IModuloMySQL, idiomas: Idiomas, paquete: IPackageConfig): Promise<ModuloMySQL> {
        const modulo = new this({
            id: row.id,
            padre: row.padre??undefined,
            descripcion: row.descripcion,
            idiomas: row.idiomas??undefined,
            version: row.version,
            hash: row.hash,
        }, idiomas, {
            nuevo: false,
            config: paquete,
        });
        await modulo.load();

        return modulo;
    }

    /* INSTANCE */
    protected async loadValues(): Promise<Record<string, Traduccion|undefined>> {
        return TraduccionLoaderMySQL.loadAll(this);
    }

    protected async loadSubmodulos(): Promise<Modulo[]> {
        return ModuloMySQL.loadPadre(this.id, this.idiomas, this.config.config);
    }

    public async fixVersion(): Promise<void> {
        if (this.cambio) {
            console.log(`Corrigiendo hash y versión del módulo ${Colors.colorize([Colors.FgGreen, Colors.Bright], this.id)}`);
            await db.update("UPDATE `modulos` SET `version`=?, `hash`=? WHERE `id`=?", [this.version, this.hash, this.id]);
            for (const value of Object.values(this.values)) {
                await value?.fixVersion();
            }

            for (const submodulo of this.submodulos as ModuloMySQL[]) {
                await submodulo.fixVersion();
            }
        }
    }

    public async toFile(basedir: string, config: IPackageConfig, padre?: ModuloJSON): Promise<void> {
        config.modulos[this.id]??={};

        const jsondir = `${basedir}/i18n/.json`;
        const json_viejo = await ModuloJSON.load(jsondir, this.id, this.idiomas, this.config.config, padre).catch(()=>undefined);

        if (json_viejo!=undefined) {
            // await json_viejo.refreshHash();
            if (json_viejo.hash == this.hash) {
                console.log("No es necesario actualizar", Colors.colorize([Colors.FgYellow, Colors.Bright], this.id));
                return;
            }
        }

        const dirJSON = `${jsondir}/${this.jerarquia.join("/")}`;

        console.log("Descargando", Colors.colorize([Colors.FgGreen, Colors.Bright], this.id));
        await this.write(dirJSON);

        // limpiamos submódulos que no existen
        const ids = [
            ...this.submodulos.map(actual=>actual.base_id),
            "_metadata.json",
            "_values.json",
        ];
        for (const file of await readDir(dirJSON)) {
            if (!ids.includes(file)) {
                console.log("Borrando", Colors.colorize([Colors.FgYellow, Colors.Bright],`${dirJSON}/${file}`));
                await unlink(`${dirJSON}/${file}`);
            }
        }

        const json_nuevo = await ModuloJSON.load(dirJSON, this.id, this.idiomas, this.config.config, padre).catch(()=>undefined);
        const include = config.modulos[this.id].include;
        const exclude = config.modulos[this.id].exclude ?? [];
        for (const actual of this.submodulos as ModuloMySQL[]) {
            if (exclude.includes(actual.base_id)) {
                continue;
            }
            if (include!=undefined && !include.includes(actual.base_id)) {
                continue;
            }
            await actual.toFile(basedir, config, json_nuevo);
        }
    }
}
