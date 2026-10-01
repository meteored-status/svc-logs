/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: eccd2deea5738e9896d1c52f9bc545e1
 * Versión: 2026.9.23+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {CustomError} from "services-comun/modules/utiles/error";

import type {ErrorCode} from "./interface";
import {type IErrorInfo} from "./interface";

/**
 * Datos necesarios para construir un {@link RequestError}.
 *
 * @property status  - Código de estado HTTP de la respuesta que originó el error.
 * @property url     - URL completa de la petición fallida.
 * @property headers - Cabeceras de la respuesta recibida.
 */
export interface IRequestError extends IErrorInfo {
    status: number;
    url: string;
    headers: Headers;
}

/**
 * Error lanzado cuando una petición HTTP no se completa correctamente.
 *
 * Extiende {@link CustomError} añadiendo contexto de red: código de estado HTTP,
 * URL solicitada y cabeceras de respuesta. El campo `code` clasifica la causa del
 * fallo mediante {@link ErrorCode}, permitiendo que el llamador distinga errores de
 * red, timeout, autenticación, respuesta malformada, etc.
 *
 * @property status  - Código de estado HTTP de la respuesta que originó el error.
 * @property url     - URL completa de la petición fallida.
 * @property headers - Cabeceras de la respuesta recibida.
 * @property code    - Clasificación del fallo según {@link ErrorCode}.
 * @property extra   - Información adicional de contexto adjuntada por el emisor del error.
 */
export class RequestError extends CustomError {
    public readonly status: number;
    public readonly url: string;
    public readonly headers: Headers;
    public readonly code: ErrorCode;
    public readonly extra?: unknown;

    public constructor(info: IRequestError) {
        super(info.message);

        this.name = "RequestError";
        this.status = info.status;
        this.url = info.url;
        this.headers = info.headers;
        this.code = info.code;
        this.extra = info.extra;
    }

    public override toString(): string {
        return `${this.code}: ${this.message}`;
    }
}
