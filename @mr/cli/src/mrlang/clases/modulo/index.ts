import {createHash} from "node:crypto";

import {mkdir, safeWrite} from "services-comun/modules/utiles/fs";

import type {Idiomas, TIdiomas} from "../idioma";
import {IdiomasLoader} from "../idioma/loader";
import {IModuloJSON} from "./json";
import {Traduccion} from "./traduccion/loader";

export interface IModulo {
    id: string;
    padre?: string;
    descripcion: string;
    idiomas?: TIdiomas;
    version: Date;
    hash: string;
}

export interface IModuloConfig {
    nuevo: boolean;
}

interface IConfig {
    include?: string[];
    exclude?: string[];
}

export interface IPackageConfig {
    lang?: string;
    langs: string[];
    modulos: Record<string, IConfig>
}

export abstract class Modulo<T extends IModuloConfig=IModuloConfig> {
    /* STATIC */
    protected static limpiarId(id: string): string {
        return id
            .split(".")
            .map((v)=>v[0].toUpperCase()+v.substring(1))
            .join("")
            .split("_")
            .map((v)=>v[0].toUpperCase()+v.substring(1))
            .join("")
            .split("-")
            .map((v)=>v[0].toUpperCase()+v.substring(1))
            .join("");
    }

    /* INSTANCE */
    public id: string;
    public padre?: string;
    public descripcion: string;
    public idiomas: Idiomas;
    protected customIdiomas?: Idiomas;
    public version: Date;
    public hash: string;

    public jerarquia: string[];
    public submodulos: Modulo[];
    protected values: NodeJS.Dict<Traduccion>;
    public base_id: string;
    protected cambio: boolean;
    public className: string;

    protected constructor(original: IModulo, idiomas: Idiomas, protected config: T) {
        this.id = original.id;
        this.padre = original.padre;
        this.descripcion = original.descripcion;
        if (original.idiomas==null) {
            this.idiomas = idiomas;
            this.customIdiomas = undefined;
        } else {
            this.idiomas = IdiomasLoader.fromJSON(original.idiomas);
            this.customIdiomas = this.idiomas;
        }
        // if (original.version==undefined || original.hash==undefined) {
        //     this.version = new Date();
        //     this.hash = "";
        //     this.config.nuevo = true;
        // } else {
        this.version = original.version;
        this.hash = original.hash;
        // }

        this.jerarquia = this.id.split(".");
        this.values = {};
        this.submodulos = [];
        this.base_id = this.jerarquia.at(-1)??this.id;
        this.cambio = false;

        this.className = Modulo.limpiarId(this.id);
    }

    public toJSON(): IModuloJSON {
        return {
            id: this.base_id,
            descripcion: this.descripcion,
            idiomas: this.customIdiomas?.toJSON(),
            version: this.version.toISOString(),
            hash: this.hash,
        };
    }

    // public print() {
    //     console.log(this.id);
    //     console.log(JSON.stringify(this.toJSON()));
    //     console.log(JSON.stringify(this.values));
    //     console.log("");
    //     this.submodulos.forEach(actual=>actual.print());
    //     console.log("");
    // }

    protected async load(): Promise<void> {
        this.values = await this.loadValues();
        this.submodulos = await this.loadSubmodulos();
    }

    public async refreshHash(): Promise<string> {
        const traducciones: NodeJS.Dict<string> = {};
        for (const [key, value] of Object.entries(this.values)) {
            if (value==undefined) continue;

            traducciones[key] = await value.refreshHash();
        }

        const submodulos: NodeJS.Dict<string> = {};
        for (const submodulo of this.submodulos) {
            submodulos[submodulo.base_id] = await submodulo.refreshHash();
        }

        const hash = createHash("md5").update(JSON.stringify({
            id: this.id,
            padre: this.padre,
            descripcion: this.descripcion,
            idiomas: this.customIdiomas,
            // assets: this.assets,
            traducciones,
            submodulos,
        })).digest("hex");

        if (hash != this.hash) {
            this.version = new Date();
            this.hash = hash;
            this.cambio = true;
        }

        return this.hash;
    }

    // protected async guardar(): Promise<void> {
    //     const idiomas = this.customIdiomas==undefined ? null : JSON.stringify(this.customIdiomas);
    //     const assets = this.assets==undefined ? null : JSON.stringify(this.assets);
    //     if (this.nuevo) {
    //         await db.update("UPDATE `modulos` SET `descripcion`=?, `idiomas`=?, `assets`=?, `servicios`=?, `hash`=? WHERE `id`=?", [this.descripcion, idiomas, assets, JSON.stringify(this.servicios), this.hash, this.id]);
    //     } else {
    //         await db.insert("INSERT INTO `modulos` (`id`, `descripcion`, `idiomas`, `assets`, `servicios`, `hash`) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=id", [this.id, this.descripcion, idiomas, assets, JSON.stringify(this.servicios), this.hash]);
    //         this.nuevo = false;
    //     }
    // }

    protected async write(dir: string): Promise<void> {
        await mkdir(dir, true);

        await safeWrite(`${dir}/_metadata.json`, JSON.stringify(this.toJSON(), null, 2), true);
        await safeWrite(`${dir}/_values.json`, JSON.stringify(Object.values(this.values).map(actual=>actual?.toJSON()).filter(actual=>actual!=undefined), null, 2), true);
    }

    protected abstract loadValues(): Promise<Record<string, Traduccion|undefined>>;
    protected abstract loadSubmodulos(): Promise<Modulo[]>;
}
