/**
 * Editor: Bixus
 * Fecha: Fri, 23 Oct 2026 10:50:35 GMT
 * Hash: 4b570a04d2c1152ad8e9ddd28828c06c
 * Versión: 2026.10.23+1-bixus
 * Anterior: 2026.9.23+1-bixus
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
 * @property detail  - El `info.message` del cuerpo de la respuesta, si venía. Ver {@link RequestError.detail}.
 */
export interface IRequestError extends IErrorInfo {
    status: number;
    url: string;
    headers: Headers;
    detail?: string;
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
 * @property detail  - El mensaje que el servidor puso en `info.message` del cuerpo de error, aparte del
 *                     `statusText` que va en `message`. Existe porque en producción el manejador de errores
 *                     **quita `extra`** (para no filtrar trazas) pero deja `info.message`: sin este campo, el
 *                     motivo de un `422` («ya está retirada», «ese tramo no es tuyo») se perdía y al llamador
 *                     solo le llegaba «Unprocessable Entity». Es texto del servidor: quien lo enseñe fuera
 *                     decide qué estados son seguros de mostrar.
 */
export class RequestError extends CustomError {
    public readonly status: number;
    public readonly url: string;
    public readonly headers: Headers;
    public readonly code: ErrorCode;
    public readonly extra?: unknown;
    public readonly detail?: string;

    public constructor(info: IRequestError) {
        super(info.message);

        this.name = "RequestError";
        this.status = info.status;
        this.url = info.url;
        this.headers = info.headers;
        this.code = info.code;
        this.extra = info.extra;
        this.detail = info.detail;
    }

    public override toString(): string {
        return `${this.code}: ${this.message}`;
    }
}
