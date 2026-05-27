import {type IRequestConfig, Peticion} from ".";

/**
 * Clase base para peticiones HTTP con cuerpo (POST, PUT, PATCH).
 *
 * Extiende {@link Peticion} sobreescribiendo `init()` para serializar `data`
 * según el `Content-Type` activo:
 *
 * - `application/json` *(por defecto)* — `JSON.stringify(data)`.
 * - `multipart/form-data` — el cuerpo se pasa directamente como `FormData`
 *   y la cabecera `Content-Type` se elimina para que `fetch` añada el boundary correcto.
 *   Se lanza `TypeError` si `data` no es una instancia de `FormData`.
 * - `text/plain` — `String(data)`.
 *
 * Cualquier otro `Content-Type` lanza `TypeError` en tiempo de ejecución.
 *
 * @template K - Tipo del dato que se enviará como cuerpo de la petición.
 *
 * @property data - Dato que se serializa y envía como cuerpo de la petición.
 */
export class PeticionData<K> extends Peticion {
    /* INSTANCE */
    protected constructor(url: string, public readonly data: K, cfg: IRequestConfig) {
        super(url, cfg);
    }

    /**
     * Extiende el `RequestInit` base añadiendo el cuerpo serializado y la política de caché.
     *
     * Establece `cache: "no-cache"` y serializa `data` según el `Content-Type` activo.
     * Rechaza la promesa con `TypeError` si el `Content-Type` no está soportado o si
     * `data` no es `FormData` cuando se usa `multipart/form-data`.
     *
     * @returns Promesa que se resuelve con el `RequestInit` completo o rechaza con `TypeError`.
     */
    protected override async init(): Promise<RequestInit> {
        const init = await super.init();
        init.cache = "no-cache";
        if (!this.headers.has("Content-Type")) {
            if (this.cfg.contentType) {
                this.headers.set("Content-Type", this.cfg.contentType);
            } else {
                this.headers.set("Content-Type", "application/json");
            }
        }
        switch(this.headers.get("Content-Type")) {
            case "application/json":
                init.body = JSON.stringify(this.data);
                break;
            case "multipart/form-data":
                if (!(this.data instanceof FormData)) {
                    return Promise.reject(new TypeError(`PeticionData: Content-Type "multipart/form-data" requiere que data sea FormData, se recibió ${typeof this.data}`));
                }
                init.body = this.data;
                this.headers.delete("Content-Type");
                break;
            case "text/plain":
                init.body = String(this.data);
                break;
            default:
                return Promise.reject(new TypeError(`PeticionData: Content-Type "${this.headers.get("Content-Type")}" no está soportado`));
        }

        return init;
    }
}
