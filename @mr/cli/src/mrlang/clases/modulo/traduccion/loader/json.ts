import {readJSON} from "services-comun/modules/utiles/fs";

import {type ITraduccionData, TraduccionOrigen, TraduccionTipo} from "..";
import {type ITraduccionLiteralValues, TraduccionLiteral} from "../literal";
import {type ITraduccionMapValues, TraduccionMap} from "../map";
import {type ITraduccionPluralValues, TraduccionPlural} from "../plural";
import {type ITraduccionSetValues, TraduccionSet} from "../set";
import {type ITraduccionValues, type Traduccion, TraduccionLoader} from ".";
import type {Modulo} from "../..";
import type {TIdiomas} from "../../../idioma";

export interface ITraduccionJSON<T=ITraduccionValues> {
    id: string;
    descripcion: string;
    origen: TraduccionOrigen;
    tipo: TraduccionTipo;
    params?: string[];
    values: ITraduccionData<T>;
    idiomas?: TIdiomas;
    version: string;
    hash: string;
}

interface ITraduccionJSONParcial<T=ITraduccionValues> {
    id: string;
    descripcion?: string;
    origen?: TraduccionOrigen;
    tipo?: TraduccionTipo;
    params?: string[];
    values?: ITraduccionData<T>;
    idiomas?: TIdiomas;
    version?: string;
    hash?: string;
}

export class TraduccionLoaderJSON extends TraduccionLoader {
    protected static async build(modulo: Modulo, id: string, data: ITraduccionJSON): Promise<Traduccion> {
        switch(data.tipo) {
            case TraduccionTipo.literal:
                return new TraduccionLiteral(modulo, id, {
                    origen: data.origen,
                    tipo: data.tipo,
                    params: data.params,
                    data: data.values as ITraduccionData<ITraduccionLiteralValues>,
                    descripcion: data.descripcion,
                    idiomas: data.idiomas,
                    version: new Date(data.version),
                    hash: data.hash,
                });
            case TraduccionTipo.plural:
                return new TraduccionPlural(modulo, id, {
                    origen: data.origen,
                    tipo: data.tipo,
                    params: data.params,
                    data: data.values as ITraduccionData<ITraduccionPluralValues>,
                    descripcion: data.descripcion,
                    idiomas: data.idiomas,
                    version: new Date(data.version),
                    hash: data.hash,
                });
            case TraduccionTipo.set:
                return new TraduccionSet(modulo, id, {
                    origen: data.origen,
                    tipo: data.tipo,
                    params: data.params,
                    data: data.values as ITraduccionData<ITraduccionSetValues>,
                    descripcion: data.descripcion,
                    idiomas: data.idiomas,
                    version: new Date(data.version),
                    hash: data.hash,
                });
            case TraduccionTipo.map:
                return new TraduccionMap(modulo, id, {
                    origen: data.origen,
                    tipo: data.tipo,
                    params: data.params,
                    data: data.values as ITraduccionData<ITraduccionMapValues>,
                    descripcion: data.descripcion,
                    idiomas: data.idiomas,
                    version: new Date(data.version),
                    hash: data.hash,
                });
        }

        return Promise.reject(`Tipo de traduccion desconocido ${data.tipo} para la traduccion ${id} del modulo ${modulo.id}`);
    }

    public static async loadAll(modulo: Modulo, basedir: string): Promise<Record<string, Traduccion|undefined>> {
        const data = await readJSON<ITraduccionJSONParcial[]>(`${basedir}/${modulo.jerarquia.join("/")}/_values.json`);
        const result: Promise<Traduccion>[] = [];
        for (const traduccion of data) {
            if (traduccion.values==undefined) {
                continue;
            }
            result.push(this.build(modulo, traduccion.id, {
                id: traduccion.id,
                origen: traduccion.origen??TraduccionOrigen.auto,
                tipo: traduccion.tipo??TraduccionTipo.literal,
                params: traduccion.params,
                values: traduccion.values,
                descripcion: traduccion.descripcion??"",
                idiomas: traduccion.idiomas,
                version: new Date(traduccion.version??0).toISOString(),
                hash: traduccion.hash??"",
            }));
        }
        const resultados = await Promise.all(result);

        const salida: Record<string, Traduccion|undefined> = {};
        for (const traduccion of resultados) {
            salida[traduccion.id] = traduccion;
        }

        return salida;
    }
}
