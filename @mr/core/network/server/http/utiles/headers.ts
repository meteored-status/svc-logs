/**
 * Editor: miguel
 * Fecha: Mon, 16 Nov 2026 15:13:05 GMT
 * Hash: 4d4ece500de5553e5535f4feee3ecc9d
 * Versión: 2026.11.16+3-miguel
 * Proyecto: https://github.com/alpred/meteored-web-www.git
 */

import type {IncomingHttpHeaders} from "node:http";

import {leerCookie} from "@mr/core-utils/navegador/storages/cookies/services/legacy-cookie-service/acciones";

/**
 * Consulta por nombre.
 *
 * - `exists`: `true` si llegó, aunque su valor esté vacío.
 * - `get`: el valor, o `undefined` si no llegó. No lanza.
 */
export interface IConsulta {
    exists(nombre: string): boolean;
    get(nombre: string): string | undefined;
}

/**
 * Cabeceras de la petición y sus cookies, al mismo nivel aunque `cookie` esté dentro de las cabeceras.
 *
 * @property headers - Cabeceras. El nombre no distingue mayúsculas; si una viene repetida, se unen con `, `.
 * @property cookies - Cookies de la cabecera `cookie`. El nombre es exacto.
 */
export interface IParserHeaders {
    headers: IConsulta;
    cookies: IConsulta;
}

/**
 * @param headers - Cabeceras de la petición (`request.headers`).
 */
export function parserHeaders(headers: IncomingHttpHeaders): IParserHeaders {
    return {
        headers: {
            exists(nombre: string): boolean {
                return headers[nombre.toLowerCase()] !== undefined;
            },
            get(nombre: string): string | undefined {
                const valor = headers[nombre.toLowerCase()];

                return Array.isArray(valor) ? valor.join(", ") : valor;
            },
        },
        cookies: {
            exists(nombre: string): boolean {
                return leerCookie(headers.cookie, nombre) !== undefined;
            },
            get(nombre: string): string | undefined {
                return leerCookie(headers.cookie, nombre);
            },
        },
    };
}
