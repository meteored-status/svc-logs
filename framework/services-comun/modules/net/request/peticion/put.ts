import {type IRequestConfig, RequestMethod} from ".";
import {PeticionData} from "./data";
import type {Respuesta} from "../respuesta";
import parser from "../parser/void";

export class PeticionPUT<K> extends PeticionData<K> {
    /* STATIC */
    public static async run<K>(url: string, data: K, cfg: Partial<IRequestConfig>={}): Promise<Respuesta<void>> {
        return new this(url, data, cfg).run(parser);
    }

    /* INSTANCE */
    protected constructor(url: string, data: K, cfg: Partial<IRequestConfig>={}) {
        super(url, data, {
            method: RequestMethod.PUT,
            ...cfg,
        });
    }
}
