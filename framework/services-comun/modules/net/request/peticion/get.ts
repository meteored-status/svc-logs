import {type IRequestConfig, Peticion, RequestMethod} from ".";
import type {Parser} from "../parser";
import type {Respuesta} from "../respuesta";

export class PeticionGET extends Peticion {
    /* STATIC */
    public static async run<T>(url: string, parser: Parser<T>, cfg: Partial<IRequestConfig>={}): Promise<Respuesta<T>> {
        return new this(url, cfg).run(parser);
    }

    /* INSTANCE */
    protected constructor(url: string, cfg: Partial<IRequestConfig>={}) {
        super(url, {
            method: RequestMethod.GET,
            ...cfg,
        });
    }
}
