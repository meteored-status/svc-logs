import {type IRequestConfig, RequestMethod} from ".";
import {PeticionData} from "./data";
import type {Respuesta} from "../respuesta";
import parser from "../parser/void";

/**
 * Petición HTTP PUT con cuerpo tipado.
 *
 * Extiende {@link PeticionData} fijando el método a `PUT` y el parser a `void`,
 * ya que las peticiones PUT típicamente no devuelven cuerpo en la respuesta.
 * Se instancia exclusivamente a través del método estático `run()`.
 *
 * @template K - Tipo del dato enviado como cuerpo.
 */
export class PeticionPUT<K> extends PeticionData<K> {
    /* STATIC */
    /**
     * Ejecuta una petición PUT con cuerpo y descarta el cuerpo de la respuesta.
     *
     * @param url  - URL del recurso a reemplazar.
     * @param data - Dato que se enviará como cuerpo serializado.
     * @param cfg  - Configuración opcional de la petición.
     * @returns Promesa que se resuelve con la respuesta sin cuerpo.
     */
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
