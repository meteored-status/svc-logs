/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:22:11 GMT
 * Hash: 37ed8b946a7f98086ecc2f061e63ab30
 * Versión: 2026.6.17+4-josantoniojimnez
 */

import type {Conexion} from "@mr/core-network/server/http/conexion";

/**
 * Devuelve el código de país de la petición de CloudFlare.
 * El código de país sigue el formato ISO-3166-1-alpha-2.
 * @param conexion Conexión de la petición de CloudFlare.
 */
export function cfCountry(conexion: Conexion): string|undefined {
    return conexion.getHeaders()["cf-ipcountry"] as string|undefined;
}

/**
 * Devuelve la IP de la petición de CloudFlare.
 * @param conexion Conexión de la petición de CloudFlare.
 */
export function cfIP(conexion: Conexion): string|undefined {
    return conexion.getHeaders()["cf-connecting-ip"] as string|undefined;
}
