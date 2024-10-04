import {type IRequestConfig, Peticion, RequestMethod} from ".";
import type {Respuesta} from "../respuesta";
import parser from "../parser/void";

export class PeticionHEAD extends Peticion {
    /* STATIC */
    public static async run(url: string, cfg: Partial<IRequestConfig>={}): Promise<Respuesta<void>> {
        return new this(url, cfg).run(parser);
    }

    /* INSTANCE */
    protected constructor(url: string, cfg: Partial<IRequestConfig>={}) {
        super(url, {
            method: RequestMethod.HEAD,
            ...cfg,
        });
    }
}
