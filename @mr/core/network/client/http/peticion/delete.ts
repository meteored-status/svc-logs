import {type IRequestConfig, Peticion, RequestMethod} from ".";
import type {Parser} from "../parser";
import type {Respuesta} from "../respuesta";

/**
 * Petición HTTP DELETE.
 *
 * Ejecuta una petición sin cuerpo y delega el parseo de la respuesta al `parser` indicado.
 * Se instancia exclusivamente a través del método estático `run()`.
 */
export class PeticionDELETE extends Peticion {
    /* STATIC */
    /**
     * Ejecuta una petición DELETE y devuelve la respuesta parseada.
     *
     * @param url    - URL del recurso a eliminar.
     * @param parser - Función que transforma la `Response` en `Respuesta<T>`.
     * @param cfg    - Configuración opcional de la petición.
     * @returns Promesa que se resuelve con la respuesta parseada.
     */
    public static async run<T>(url: string, parser: Parser<T>, cfg: Partial<IRequestConfig>={}): Promise<Respuesta<T>> {
        return new this(url, cfg).run(parser);
    }

    /* INSTANCE */
    protected constructor(url: string, cfg: Partial<IRequestConfig>={}) {
        super(url, {
            method: RequestMethod.DELETE,
            ...cfg,
        });
    }
}
