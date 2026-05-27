import {type IRequestConfig, RequestMethod} from ".";
import type {Parser} from "../parser";
import {PeticionData} from "./data";
import type {Respuesta} from "../respuesta";

/**
 * Petición HTTP POST con cuerpo tipado.
 *
 * Extiende {@link PeticionData} fijando el método a `POST`. El cuerpo se serializa
 * según el `Content-Type` configurado (`application/json` por defecto).
 * Se instancia exclusivamente a través del método estático `run()`.
 *
 * @template K - Tipo del dato enviado como cuerpo.
 */
export class PeticionPOST<K> extends PeticionData<K> {
    /* STATIC */
    /**
     * Ejecuta una petición POST con cuerpo y devuelve la respuesta parseada.
     *
     * @param url    - URL del endpoint.
     * @param data   - Dato que se enviará como cuerpo serializado.
     * @param parser - Función que transforma la `Response` en `Respuesta<T>`.
     * @param cfg    - Configuración opcional de la petición.
     * @returns Promesa que se resuelve con la respuesta parseada.
     */
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
