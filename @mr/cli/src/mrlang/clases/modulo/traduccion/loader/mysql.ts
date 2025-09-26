import {type ITraduccionData, type TraduccionOrigen, TraduccionTipo} from "..";
import {ITraduccionLiteralValues, TraduccionLiteral} from "../literal";
import {type ITraduccionValues, type Traduccion, TraduccionLoader} from ".";
import {Modulo} from "../..";
import type {TIdiomas} from "../../../idioma";
import {ITraduccionMapValues, TraduccionMap} from "../map";
import {ITraduccionPluralValues, TraduccionPlural} from "../plural";
import {ITraduccionSetValues, TraduccionSet} from "../set";
import db from "../../../../mysql";

export interface ITraduccionMySQL<T=ITraduccionValues> {
    origen: TraduccionOrigen;
    tipo: TraduccionTipo;
    params: string[]|null;
    data: ITraduccionData<T>|null;
    descripcion: string;
    idiomas: TIdiomas|null;
    version: Date;
    hash: string;
}

interface ITraduccionAllMySQL<T=ITraduccionValues> extends ITraduccionMySQL<T> {
    id: string;
    borrado: number;
}

export class TraduccionLoaderMySQL extends TraduccionLoader {
    protected static async build(modulo: Modulo, id: string, data: ITraduccionMySQL): Promise<Traduccion> {
        if (data.data==undefined) {
            return Promise.reject(`No hay datos para la traduccion ${id} del modulo ${modulo.id}`);
        }

        switch(data.tipo) {
            case TraduccionTipo.literal:
                return new TraduccionLiteral(modulo, id, {
                    origen: data.origen,
                    tipo: data.tipo,
                    params: data.params??undefined,
                    data: data.data as ITraduccionData<ITraduccionLiteralValues>,
                    descripcion: data.descripcion,
                    idiomas: data.idiomas??undefined,
                    version: data.version,
                    hash: data.hash,
                });
            case TraduccionTipo.plural:
                return new TraduccionPlural(modulo, id, {
                    origen: data.origen,
                    tipo: data.tipo,
                    params: data.params??undefined,
                    data: data.data as ITraduccionData<ITraduccionPluralValues>,
                    descripcion: data.descripcion,
                    idiomas: data.idiomas??undefined,
                    version: data.version,
                    hash: data.hash,
                });
            case TraduccionTipo.set:
                return new TraduccionSet(modulo, id, {
                    origen: data.origen,
                    tipo: data.tipo,
                    params: data.params??undefined,
                    data: data.data as ITraduccionData<ITraduccionSetValues>,
                    descripcion: data.descripcion,
                    idiomas: data.idiomas??undefined,
                    version: data.version,
                    hash: data.hash,
                });
            case TraduccionTipo.map:
                return new TraduccionMap(modulo, id, {
                    origen: data.origen,
                    tipo: data.tipo,
                    params: data.params??undefined,
                    data: data.data as ITraduccionData<ITraduccionMapValues>,
                    descripcion: data.descripcion,
                    idiomas: data.idiomas??undefined,
                    version: data.version,
                    hash: data.hash,
                });
        }

        return Promise.reject(`Tipo de traduccion desconocido ${data.tipo} para la traduccion ${id} del modulo ${modulo.id}`);
    }

    public static async existe(modulo: Modulo, id: string): Promise<boolean> {
        const [data] = await db.select<{
            id: string
        }>("SELECT `id` FROM `traducciones` WHERE `modulo`=? AND `id`=? AND `borrado`=0", [modulo.id, id]);
        return data!=undefined;
    }

    // public static async load(modulo: Modulo, id: string): Promise<Traduccion> {
    //     const [data] = await db.select<ITraduccionMySQL>("SELECT `tipo`, `params`, `data`, `descripcion`, `idiomas`, `assets`, `version`, `hash` FROM `traducciones` WHERE `modulo`=? AND `id`=?", [modulo.id, id]);
    //     if (data==undefined) {
    //         return Promise.reject(`No existe la traduccion ${id} del modulo ${modulo.id}`);
    //     }
    //
    //     return this.build(modulo, id, data);
    // }

    public static async loadAll(modulo: Modulo): Promise<NodeJS.Dict<Traduccion>> {
        const data = await db.select<ITraduccionAllMySQL>("SELECT `id`, `origen`, `tipo`, `params`, `data`, `descripcion`, `idiomas`, `version`, `hash` FROM `traducciones` WHERE `modulo`=? AND `borrado`=0", [modulo.id]);
        const result: Promise<Traduccion>[] = [];
        for (const traduccion of data) {
            result.push(this.build(modulo, traduccion.id, traduccion));
        }
        const resultados = await Promise.all(result);

        const salida: NodeJS.Dict<Traduccion> = {};
        for (const traduccion of resultados) {
            salida[traduccion.id] = traduccion;
        }

        return salida;
    }
}
