import {createHash} from "node:crypto";
import {safeWrite} from "services-comun/modules/utiles/fs";

import type {Idiomas, TIdiomas} from "../../idioma";
import {IdiomasLoader} from "../../idioma/loader";
import type {ITraduccionJSON} from "./loader/json";
import type {Modulo} from "..";
import db from "../../../mysql";

export enum TraduccionTipo {
    literal = "literal",
    plural = "plural",
    set = "set",
    map = "map",
}

export enum TraduccionOrigen {
    auto = "auto",
    interno = "interno",
    externo = "externo",
}

export interface ITraduccionData<T> {
    defecto: T;
    valor: Record<string, T|undefined>;
}

export interface ITraduccionBase {
    id: string;
    tipo: TraduccionTipo;
    params?: string[];
    className: string;
    keys?: string;
}

export interface ITraduccion<T> {
    origen: TraduccionOrigen;
    tipo: TraduccionTipo;
    params?: string[];
    data: ITraduccionData<T>;
    descripcion: string;
    idiomas?: TIdiomas;
    version: Date;
    hash: string;
}

export abstract class Traduccion<T> implements ITraduccionBase {
    /* STATIC */
    private static limpiarId(id: string): string {
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
    public origen: TraduccionOrigen;
    public tipo: TraduccionTipo;
    public params?: string[];
    public data: ITraduccionData<T>;
    public descripcion: string;
    public idiomas: Idiomas;
    protected customIdiomas?: Idiomas;

    public version: Date;
    public hash: string;

    public className: string;

    private contenido: Record<string, string>;

    protected constructor(public readonly modulo: Modulo, public readonly id: string, protected readonly original: ITraduccion<T>, public nuevo: boolean = false) {
        this.origen = original.origen;
        this.tipo = original.tipo;
        this.params = original.params;
        this.data = original.data;
        this.data.valor ??= {};
        this.descripcion = original.descripcion;
        if (original.idiomas==undefined) {
            this.idiomas = modulo.idiomas;
            this.customIdiomas = undefined;
        } else {
            this.idiomas = IdiomasLoader.fromJSON(original.idiomas);
            this.customIdiomas = this.idiomas;
        }
        this.version = original.version;
        this.hash = original.hash;

        this.className = `${this.modulo.className}${Traduccion.limpiarId(this.id)}`;

        this.contenido = {};
    }

    public toJSON(): ITraduccionJSON<T> {
        return {
            id: this.id,
            descripcion: this.descripcion,
            origen: this.origen,
            tipo: this.tipo,
            params: this.params,
            values: this.data,
            idiomas: this.customIdiomas?.toJSON(),
            version: this.version.toISOString(),
            hash: this.hash
        };
    }

    public async refreshHash(): Promise<string> {
        const hash = createHash("md5").update(JSON.stringify({
            // modulo: this.modulo.id,
            // id: this.id,
            origen: this.origen,
            tipo: this.tipo,
            params: this.params,
            values: this.data,
            descripcion: this.descripcion,
            idiomas: this.idiomas,
        })).digest("hex");

        if (hash != this.hash) {
            this.version = new Date();
            this.hash = hash;
        }

        return this.hash;
    }

    public async guardar(): Promise<void> {
        const params = this.params==undefined ? null : JSON.stringify(this.params);
        const data = this.data==undefined ? null : JSON.stringify(this.data);
        const idiomas = this.customIdiomas==undefined ? null : JSON.stringify(this.customIdiomas);

        if (!this.nuevo) {
            await db.update("UPDATE `traducciones` SET `origen`=?, `tipo`=?, `params`=?, `data`=?, `descripcion`=?, `idiomas`=?, `hash`=?, `version`=? WHERE `modulo`=? AND `id`=?", [this.origen, this.tipo, params, data, this.descripcion, idiomas, this.hash, this.version, this.modulo.id, this.id]);
        } else {
            await db.insert("INSERT INTO `traducciones` (`modulo`, `id`, `origen`, `tipo`, `params`, `data`, `descripcion`, `idiomas`, `hash`, `version`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=id", [this.modulo.id, this.id, this.origen, this.tipo, params, data, this.descripcion, idiomas, this.hash, this.version]);
            this.nuevo = false;
        }
    }

    public async fixVersion(): Promise<void> {
        await db.update("UPDATE `traducciones` SET `hash`=?, `version`=? WHERE `modulo`=? AND `id`=?", [this.hash, this.version, this.modulo.id, this.id]);
    }

    public async write(dir: string, jerarquia: string[]): Promise<void> {
        const key = jerarquia.join(".");
        this.contenido[key] ??= this.template(jerarquia).replaceAll("\\", "\\\\");
        await safeWrite(`${dir}/${this.id.replaceAll("-", "_")}.ts`, this.contenido[key]);
    }

    public clean(): void {
        this.contenido = {};
    }

    public template(jerarquia: string[]): string {
        if (this.params==undefined) {
            return this.templateNoParams(jerarquia);
        }
        return this.templateParams(jerarquia, this.params);
    }

    public getIdioma(idiomas: string[]): string|undefined {
        for (let i=0, len=idiomas.length; i<len; i++) {
            const valor = this.data.valor[idiomas[i]];
            if (valor!=undefined) {
                return idiomas[i];
            }
        }

        return undefined;
    }

    public abstract valores(jerarquia: string[]): T;
    protected abstract templateNoParams(jerarquia: string[]): string;
    protected abstract templateParams(jerarquia: string[], params: string[]): string;
}
