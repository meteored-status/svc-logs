export class Respuesta<T> {
    /* INSTANCE */
    public readonly status: number;
    public readonly headers: Headers;
    public readonly expires: Date;
    public readonly cacheable: boolean;

    public constructor(protected response: Response, public readonly data: T, expiracion?: Date) {
        this.headers = response.headers;

        this.status = response.status;
        const expires = response.headers.get("expires");
        if (expires!=undefined) {
            this.expires = new Date(expires);
            this.cacheable = true;
        } else {
            this.expires = expiracion??new Date();
            this.cacheable = false;
        }
    }
}
