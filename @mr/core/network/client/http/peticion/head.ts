import {type IRequestConfig, Peticion, RequestMethod} from ".";
import type {Respuesta} from "../respuesta";
import parser from "../parser/void";

/**
 * Petición HTTP HEAD.
 *
 * Ejecuta una petición sin cuerpo y descarta el cuerpo de la respuesta (`void`).
 * Útil para comprobar la existencia o los encabezados de un recurso sin transferir su contenido.
 * Se instancia exclusivamente a través del método estático `run()`.
 */
export class PeticionHEAD extends Peticion {
    /* STATIC */
    /**
     * Ejecuta una petición HEAD y descarta el cuerpo de la respuesta.
     *
     * @param url - URL del recurso.
     * @param cfg - Configuración opcional de la petición.
     * @returns Promesa que se resuelve con la respuesta sin cuerpo.
     */
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
