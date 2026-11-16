/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 44961d47fca39fa5411bdd0ae2143e2b
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {EEntorno} from "@mr/core-log/interface";

import {RUTA_HEARTBEAT} from "./interface";

/** Receptor por defecto, solo en producción y test: la dirección pública de status. */
export const SOCKET_POR_DEFECTO = "https://status.meteored.com";

/**
 * Forma del token que acepta el receptor: `hb1.<id>.<secreto>`, con `id` de 1 a 32 caracteres y secreto de 1 a 200,
 * todos de `A-Z a-z 0-9 _ -` (el mismo formato que `parsearToken` en `status-external`, que es quien lo define).
 */
const FORMATO_TOKEN = /^hb1\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{1,200}$/;

/** Token que se manda fuera de producción cuando no hay `HEARTBEAT_TOKEN` (el receptor de desarrollo acepta cualquiera). */
const TOKEN_DESARROLLO = "desarrollo";

/**
 * Lo que decide si un proceso emite heartbeat.
 *
 * @property env - Variables de entorno.
 * @property entorno - Entorno del bundle (`entornoActual()`).
 * @property tipo - Tipo de despliegue del manifest (`pod.tipo`).
 * @property target - Destino del despliegue (`pod.target`).
 */
export interface IEntradaDecision {
    env: Record<string, string|undefined>;
    entorno: EEntorno;
    tipo: string;
    target: string;
}

/**
 * Configuración con la que se emite.
 *
 * @property socket - URL completa del receptor, con la ruta.
 * @property token - Valor de la cabecera de autorización.
 */
export interface IConfigHeartbeat {
    socket: string;
    token: string;
}

/**
 * Resultado de {@link decidirHeartbeat}.
 *
 * @property habilitado - Si se emite.
 * @property config - Con qué, solo si `habilitado`.
 * @property motivo - Por qué no, solo si no `habilitado`.
 * @property avisar - Si el motivo merece un `warning` (un error de configuración) o es lo normal (no aplica).
 * @property avisos - Advertencias que hay que dar una sola vez (p. ej. `ENTORNO` incoherente). Vacío si el heartbeat no aplica
 *   (no es un servicio de k8s o `HEARTBEAT` no es `true`).
 */
export type TDecision = {
    habilitado: true;
    config: IConfigHeartbeat;
    avisos: string[];
}|{
    habilitado: false;
    motivo: string;
    avisar: boolean;
    avisos: string[];
};

/**
 * Entorno que declara la variable `ENTORNO`, o `null` si no la reconoce.
 */
function entornoDeclarado(valor: string): EEntorno|null {
    switch (valor.trim().toLowerCase()) {
        case "produccion":
        case "production":
        case "prod":
            return EEntorno.PRODUCCION;
        case "test":
        case "testing":
            return EEntorno.TEST;
        case "desarrollo":
        case "development":
        case "dev":
        case "local":
            return EEntorno.DESARROLLO;
        default:
            return null;
    }
}

/**
 * Si un token tiene la forma `hb1.<id>.<secreto>`. Solo se comprueba la forma: si es el bueno lo decide el
 * receptor.
 */
export function tokenConFormato(token: string): boolean {
    return FORMATO_TOKEN.test(token);
}

/**
 * Completa la URL del receptor: una dirección base (`ws://servicio` o `https://dominio`, sin ruta) recibe
 * {@link RUTA_HEARTBEAT}; si ya trae una ruta distinta de `/`, se respeta tal cual.
 *
 * @param base - Valor de `HEARTBEAT_SOCKET` o el receptor por defecto.
 * @throws Si no es una URL.
 */
export function construirUrl(base: string): string {
    const url = new URL(base);
    if (url.pathname === "/") {
        url.pathname = RUTA_HEARTBEAT;
    }

    return url.toString();
}

/**
 * Decide si el proceso emite heartbeat, y con qué.
 *
 * Solo se emite en un servicio (`tipo` `service`) desplegado en Kubernetes (`target` `k8s`) con
 * `HEARTBEAT=true`. **Producción** aquí es todo lo que no es desarrollo (test también lo es, como en
 * `crearPodInfo`). Fuera de producción no hay receptor por defecto —para no mandar nunca heartbeats locales
 * a producción— y el token es opcional; en producción el token es obligatorio y tiene que tener la forma `hb1.<id>.<secreto>`.
 * Los `avisos` (p. ej. `ENTORNO` incoherente) solo se dan si el heartbeat queda habilitado o falla por configuración.
 */
export function decidirHeartbeat({env, entorno, tipo, target}: IEntradaDecision): TDecision {
    if (tipo !== "service" || target !== "k8s") {
        return {habilitado: false, motivo: `solo emiten los servicios de k8s (tipo ${tipo}, target ${target})`, avisar: false, avisos: []};
    }
    if (env["HEARTBEAT"] !== "true") {
        return {habilitado: false, motivo: "HEARTBEAT no es true", avisar: false, avisos: []};
    }

    // Los avisos solo cuentan si el heartbeat está habilitado: un cronjob o un servicio sin `HEARTBEAT=true` no tiene por
    // qué dar cuenta de una variable que no le afecta.
    const avisos: string[] = [];
    const declarado = env["ENTORNO"] ?? "";
    if (declarado.length > 0 && entornoDeclarado(declarado) !== entorno) {
        avisos.push(`Heartbeat: la variable ENTORNO="${declarado}" no coincide con el entorno del bundle (${EEntorno[entorno]})`);
    }

    const produccion = entorno !== EEntorno.DESARROLLO;
    const base = (env["HEARTBEAT_SOCKET"] ?? "").trim();
    if (base.length === 0 && !produccion) {
        return {habilitado: false, motivo: "fuera de producción no hay receptor por defecto: falta HEARTBEAT_SOCKET", avisar: true, avisos};
    }
    // Recortado: el token llega de un Secret montado desde un fichero, y un salto de línea al final —lo que deja cualquier
    // editor— haría que el hash no coincidiera nunca y todos los pods se quedaran fuera con un 401.
    const token = (env["HEARTBEAT_TOKEN"] ?? "").trim();
    if (token.length === 0 && produccion) {
        return {habilitado: false, motivo: "falta HEARTBEAT_TOKEN", avisar: true, avisos};
    }
    if (produccion && !tokenConFormato(token)) {
        // Sin el valor: es una credencial.
        return {habilitado: false, motivo: "HEARTBEAT_TOKEN no tiene el formato hb1.<id>.<secreto> que espera el receptor", avisar: true, avisos};
    }

    let socket: string;
    try {
        socket = construirUrl(base.length > 0 ? base : SOCKET_POR_DEFECTO);
    } catch {
        return {habilitado: false, motivo: `HEARTBEAT_SOCKET no es una URL válida: ${base}`, avisar: true, avisos};
    }

    return {habilitado: true, config: {socket, token: token.length > 0 ? token : TOKEN_DESARROLLO}, avisos};
}
