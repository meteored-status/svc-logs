/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: c1db44994780e4c8ec3c9660d4d7928c
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import http from "node:http";

import {Deferred} from "services-comun/modules/utiles/promise";
import {warning} from "services-comun/modules/utiles/log";

/** Servidor de metadatos de GKE. */
const HOST_METADATOS = "metadata.google.internal";

/** Tiempo (ms) que se espera a cada petición al servidor de metadatos. */
export const TIMEOUT_METADATOS_MS = 1000;

/**
 * De dónde sale un valor: del servidor de metadatos, de una variable de entorno `HEARTBEAT_*`, o de
 * ninguna parte.
 */
export type TOrigenMetadato = "metadata"|"env"|"vacío";

/**
 * Un valor con su origen.
 *
 * @property valor - El valor; cadena vacía si no se pudo obtener.
 * @property origen - De dónde sale.
 */
export interface IMetadato {
    valor: string;
    origen: TOrigenMetadato;
}

/**
 * Cluster, proyecto de GCP y ubicación del pod. No cambian en toda la vida del proceso.
 */
export interface IMetadatosPod {
    cluster: IMetadato;
    proyecto: IMetadato;
    ubicacion: IMetadato;
}

/**
 * Respuesta cruda del servidor de metadatos.
 *
 * @property status - Código HTTP.
 * @property flavor - Valor de la cabecera `Metadata-Flavor`.
 * @property cuerpo - Cuerpo en texto.
 */
export interface IRespuestaMetadatos {
    status: number;
    flavor: string|undefined;
    cuerpo: string;
}

/**
 * Pide una ruta al servidor de metadatos; `null` si falla o vence el timeout.
 */
export type TLectorMetadatos = (ruta: string) => Promise<IRespuestaMetadatos|null>;

/**
 * Espera `ms` milisegundos.
 */
export type TEsperaMetadatos = (ms: number) => Promise<void>;

/**
 * Configuración de {@link leerMetadatos}.
 *
 * @property env - Variables de entorno.
 * @property leer - Lector del servidor de metadatos. Por defecto {@link leerRutaMetadatos}.
 * @property consultar - Si es `false` no se pregunta al servidor de metadatos (fuera del clúster). Por defecto `true`.
 * @property reintentar - Si es `true` reintenta con backoff hasta tener los tres valores y no resuelve antes. Por defecto `false`.
 * @property esperar - Espera entre reintentos (inyectable en las pruebas). Por defecto un temporizador sin retener el proceso.
 * @property primeraEsperaMs - Espera antes del primer reintento; se duplica en cada uno. Por defecto 1000.
 * @property maxEsperaMs - Tope de la espera entre reintentos. Por defecto 30000.
 */
export interface IConfigMetadatos {
    env: Record<string, string|undefined>;
    leer?: TLectorMetadatos;
    consultar?: boolean;
    reintentar?: boolean;
    esperar?: TEsperaMetadatos;
    primeraEsperaMs?: number;
    maxEsperaMs?: number;
}

/**
 * Interpreta una respuesta del servidor de metadatos: solo vale si es un `200` que devuelve
 * `Metadata-Flavor: Google` (otra cosa contestando en esa dirección no es el servidor de metadatos) y trae
 * algo más que espacios.
 *
 * @returns El valor limpio, o `null` si no vale.
 */
export function interpretarRespuesta(respuesta: IRespuestaMetadatos|null): string|null {
    if (respuesta === null || respuesta.status !== 200 || respuesta.flavor !== "Google") {
        return null;
    }
    const valor = respuesta.cuerpo.trim();

    return valor.length > 0 ? valor : null;
}

/**
 * Combina las variables de entorno y las respuestas del servidor de metadatos: **manda el entorno** si está
 * definido y no vacío.
 *
 * @param env - Variables de entorno (`HEARTBEAT_CLUSTER`, `HEARTBEAT_PROYECTO`, `HEARTBEAT_UBICACION`).
 * @param respuestas - Valor ya interpretado de cada metadato (`null` si no se obtuvo).
 */
export function resolverMetadatos(env: Record<string, string|undefined>, respuestas: {cluster: string|null; proyecto: string|null; ubicacion: string|null}): IMetadatosPod {
    const elegir = (variable: string, metadata: string|null): IMetadato => {
        const entorno = env[variable] ?? "";
        if (entorno.length > 0) {
            return {valor: entorno, origen: "env"};
        }

        return metadata !== null ? {valor: metadata, origen: "metadata"} : {valor: "", origen: "vacío"};
    };

    return {
        cluster: elegir("HEARTBEAT_CLUSTER", respuestas.cluster),
        proyecto: elegir("HEARTBEAT_PROYECTO", respuestas.proyecto),
        ubicacion: elegir("HEARTBEAT_UBICACION", respuestas.ubicacion),
    };
}

/**
 * Lector real: `GET http://metadata.google.internal<ruta>` con `Metadata-Flavor: Google` y timeout de
 * {@link TIMEOUT_METADATOS_MS}. Nunca rechaza.
 */
export const leerRutaMetadatos: TLectorMetadatos = async (ruta) => {
    const deferred = new Deferred<IRespuestaMetadatos|null>();
    const peticion = http.get({
        host: HOST_METADATOS,
        path: ruta,
        headers: {"Metadata-Flavor": "Google"},
        timeout: TIMEOUT_METADATOS_MS,
    }, (respuesta) => {
        const trozos: Buffer[] = [];
        respuesta.on("data", (trozo: Buffer) => { trozos.push(trozo); });
        respuesta.on("error", () => { deferred.resolve(null); });
        respuesta.on("end", () => {
            const flavor = respuesta.headers["metadata-flavor"];
            deferred.resolve({
                status: respuesta.statusCode ?? 0,
                flavor: Array.isArray(flavor) ? flavor[0] : flavor,
                cuerpo: Buffer.concat(trozos).toString("utf-8"),
            });
        });
    });
    peticion.on("timeout", () => {
        peticion.destroy();
        deferred.resolve(null);
    });
    peticion.on("error", () => { deferred.resolve(null); });

    return deferred.promise;
};

type TClave = "cluster"|"ubicacion"|"proyecto";

const CLAVES: readonly TClave[] = ["cluster", "ubicacion", "proyecto"];

const RUTAS: Readonly<Record<TClave, string>> = {
    cluster: "/computeMetadata/v1/instance/attributes/cluster-name",
    ubicacion: "/computeMetadata/v1/instance/attributes/cluster-location",
    proyecto: "/computeMetadata/v1/project/project-id",
};

const VARIABLES: Readonly<Record<TClave, string>> = {
    cluster: "HEARTBEAT_CLUSTER",
    ubicacion: "HEARTBEAT_UBICACION",
    proyecto: "HEARTBEAT_PROYECTO",
};

/** Espera real, sin retener el proceso. */
const esperarReal: TEsperaMetadatos = async (ms) => {
    const deferred = new Deferred<void>();
    setTimeout(() => { deferred.resolve(); }, ms).unref();

    return deferred.promise;
};

/**
 * Lee cluster, proyecto y ubicación: las peticiones al servidor de metadatos en paralelo (las que
 * ya define el entorno no se piden). **Nunca rechaza**.
 *
 * - Sin `reintentar`: un solo intento; lo que falla queda vacío y se avisa una vez.
 * - Con `reintentar` (producción): **no resuelve hasta tener los tres** (o hasta que las `HEARTBEAT_*` los
 *   definan). Reintenta solo los que faltan, con backoff (`primeraEsperaMs`, el doble, el doble… hasta
 *   `maxEsperaMs`), y avisa **una sola vez** mientras siga fallando. Son parte de la clave de la tabla del
 *   receptor, así que un pod que emitiera con ellos vacíos quedaría para siempre en otra fila.
 */
export async function leerMetadatos({env, leer = leerRutaMetadatos, consultar = true, reintentar = false, esperar = esperarReal, primeraEsperaMs = 1000, maxEsperaMs = 30000}: IConfigMetadatos): Promise<IMetadatosPod> {
    const respuestas: Record<TClave, string|null> = {cluster: null, ubicacion: null, proyecto: null};
    const faltan = (): TClave[] => CLAVES.filter((clave) => respuestas[clave] === null && (env[VARIABLES[clave]] ?? "").length === 0);

    let espera = primeraEsperaMs;
    let avisado = false;
    while (consultar) {
        const pendientes = faltan();
        if (pendientes.length === 0) {
            break;
        }
        const lecturas = await Promise.all(pendientes.map(async (clave) => interpretarRespuesta(await leer(RUTAS[clave]).catch(() => null))));
        pendientes.forEach((clave, i) => { respuestas[clave] = lecturas[i] ?? null; });

        const restantes = faltan();
        if (restantes.length === 0) {
            break;
        }
        if (!avisado) {
            avisado = true;
            warning(reintentar ?
                `Heartbeat: no se pudo leer del servidor de metadatos de GKE: ${restantes.join(", ")}. Se reintenta con backoff (hasta cada ${maxEsperaMs / 1000} s) y no se emite hasta tenerlos; HEARTBEAT_CLUSTER, HEARTBEAT_PROYECTO y HEARTBEAT_UBICACION lo evitan` :
                `Heartbeat: no se pudo leer del servidor de metadatos de GKE: ${restantes.join(", ")}`);
        }
        if (!reintentar) {
            break;
        }
        await esperar(espera);
        espera = Math.min(espera * 2, maxEsperaMs);
    }

    return resolverMetadatos(env, {cluster: respuestas.cluster, proyecto: respuestas.proyecto, ubicacion: respuestas.ubicacion});
}
