/**
 * Encapsula la respuesta HTTP de una petición exitosa junto con sus metadatos de caché.
 *
 * Extrae automáticamente la cabecera `Expires` de la respuesta para determinar si el
 * resultado es cacheable. Si la cabecera está presente, `cacheable` es `true` y `expires`
 * refleja la fecha indicada por el servidor; en caso contrario, `cacheable` es `false` y
 * `expires` toma el valor del parámetro `expiracion` o la fecha actual.
 *
 * @template T - Tipo del cuerpo de la respuesta ya parseado y tipado.
 *
 * @property status    - Código de estado HTTP de la respuesta.
 * @property headers   - Cabeceras de la respuesta.
 * @property data      - Cuerpo de la respuesta ya parseado con el tipo `T`.
 * @property expires   - Fecha de expiración extraída de la cabecera `Expires`,
 *   o el valor de `expiracion` si no estaba presente (por defecto, fecha actual).
 * @property cacheable - `true` si la respuesta incluía la cabecera `Expires`; `false` en caso contrario.
 */
export class Respuesta<T> {
    /* INSTANCE */
    public readonly status: number;
    public readonly headers: Headers;
    public readonly expires: Date;
    public readonly cacheable: boolean;

    public constructor(response: Response, public readonly data: T, expiracion?: Date) {
        this.headers = response.headers;

        this.status = response.status;
        const expires = response.headers.get("expires");
        if (expires) {
            this.expires = new Date(expires);
            this.cacheable = true;
        } else {
            this.expires = expiracion??new Date();
            this.cacheable = false;
        }
    }
}
