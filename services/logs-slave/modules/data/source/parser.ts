import {type IRAWData, type IRegistroApp, type IRegistroCrawler, type IRegistroES, Registro} from "../registro";
import SCHEMA from "./cloudflare";

import type {Cliente} from "../cliente";

/** Tráfico interno de Cloudflare: se descarta, no tiene valor analítico. */
const FILTRAR_PATHS_PREFIX: string[] = [
    "/cdn-cgi/",
];

/**
 * Filas acumuladas de un fichero, una lista por tabla de destino en BigQuery.
 *
 * @property appInvalidas - Motivos de las peticiones de app descartadas por traer un header
 *                          `meteored` mal formado. Su fila de `accesos` sí se conserva; quien
 *                          orquesta la ingesta decide cómo loguearlos.
 */
export interface ISalida {
    accesos: IRegistroES[];
    crawler: IRegistroCrawler[];
    app: IRegistroApp[];
    appInvalidas: string[];
}

export const nuevaSalida = (): ISalida => ({
    accesos: [],
    crawler: [],
    app: [],
    appInvalidas: [],
});

/**
 * ¿La petición pertenece a una app móvil? O bien trae el header `meteored`, o bien cumple una de
 * las dos heurísticas legacy cableadas por cliente.
 */
export const esApp = (cliente: Cliente, cf: IRAWData): boolean => {
    if (cf.request.headers.app) {
        return true;
    }
    if (cliente.id==="mr" && cf.client.request.path.startsWith("/app/")) {
        return true;
    }

    return cliente.id==="tiempo" && cf.client.request.path.includes("peticionMovil.php");
};

/**
 * Parsea una línea del fichero y acumula sus filas en `salida`. Lanza si la línea no es un JSON
 * válido o no cumple el esquema de Cloudflare, para que el bucle de ingesta pueda descartarla sin
 * perder el resto del fichero.
 */
export const procesarLinea = (cliente: Cliente, linea: string, salida: ISalida): void => {
    const cf: IRAWData = SCHEMA.parse(JSON.parse(linea));
    if (FILTRAR_PATHS_PREFIX.some(path=>cf.client.request.path.startsWith(path))) {
        return;
    }

    const registro = Registro.build(cf, cliente);
    salida.accesos.push(registro.toJSON());

    if (cf.client.bot) {
        salida.crawler.push(registro.toCrawler());
    }

    if (esApp(cliente, cf)) {
        try {
            salida.app.push(registro.toApp(cf.request.headers.app));
        } catch (err) {
            // un header de app mal formado no debe tirar la fila de accesos, que ya está acumulada
            salida.appInvalidas.push(err instanceof Error ? err.message : JSON.stringify(err));
        }
    }
};
