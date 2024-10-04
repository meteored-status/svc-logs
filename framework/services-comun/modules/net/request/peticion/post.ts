import {type IRequestConfig, RequestMethod} from ".";
import type {Parser} from "../parser";
import {PeticionData} from "./data";
import type {Respuesta} from "../respuesta";

export class PeticionPOST<K> extends PeticionData<K> {
    /* STATIC */
    public static async run<T, K>(url: string, data: K, parser: Parser<T>, cfg: Partial<IRequestConfig>={}): Promise<Respuesta<T>> {
        return new this(url, data, cfg).run(parser);
    }

    /* INSTANCE */
    protected constructor(url: string, data: K, cfg: Partial<IRequestConfig>={}) {
        super(url, data, {
            method: RequestMethod.POST,
            ...cfg,
        });
    }
}
