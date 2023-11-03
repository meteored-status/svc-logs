import {Conexion} from "../net/conexion";

/**
 * Devuelve el código de país de la petición de CloudFlare.
 * El código de país sigue el formato ISO-3166-1-alpha-2.
 * @param conexion Conexión de la petición de CloudFlare.
 */
export function cfCountry(conexion: Conexion): string|undefined {
    return conexion.getHeaders()["cf-ipcountry"] as string|undefined;
}
