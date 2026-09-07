/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: d450347b29e2614d8f34ae2d0a3a6419
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {createHash} from "node:crypto";

import {safeWrite} from "@mr/core-cli/fs";
import type {Idiomas, TIdiomas} from "../../idioma";
import {IdiomasLoader} from "../../idioma/loader";
import type {ITraduccionJSON} from "./loader/json";
import type {Modulo} from "..";

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

    protected constructor(public readonly modulo: Modulo, public readonly id: string, protected readonly original: ITraduccion<T>) {
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
