/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: 81c1044e56f5a021a43bdda12bef96e4
 * Versión: 2026.11.20+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IHeartbeatEjecucion, TCargaPod, TConcurrenciaCron} from "./interface";

/**
 * Lo que un pod de una carga finita (cronjob o job) sabe de su ejecución por el entorno, que inyecta el kustomize.
 *
 * @property job - Nombre del Job (`POD_JOB`, o el hostname sin su último trozo `-xxxxx`).
 * @property jobUid - UID del Job (`POD_JOB_UID`); `''` si no llega.
 * @property cronjob - Nombre del CronJob (`CRON_NOMBRE`); `''` si no llega.
 * @property indice - `JOB_COMPLETION_INDEX` (lo inyecta Kubernetes en los Jobs `Indexed`) si es un entero decimal de 0 a 65535; `null` en cualquier otro caso.
 * @property programacion - `CRON_SCHEDULE`, o `null`.
 * @property zonaHoraria - `CRON_TIMEZONE`, o `null`.
 * @property concurrencia - `CRON_CONCURRENCIA` si es un valor válido, o `null`.
 * @property plazoInicioS - `CRON_PLAZO_INICIO_S` (entero >= 0), o `null`.
 * @property plazoEjecucionS - `CRON_PLAZO_EJECUCION_S` (entero >= 0), o `null`.
 */
export interface IEntornoCron {
    job: string;
    jobUid: string;
    cronjob: string;
    indice: number|null;
    programacion: string|null;
    zonaHoraria: string|null;
    concurrencia: TConcurrenciaCron|null;
    plazoInicioS: number|null;
    plazoEjecucionS: number|null;
}

/**
 * Configuración de {@link leerEntornoCron}.
 *
 * @property hostname - `os.hostname()`: de aquí sale el nombre del Job si `POD_JOB` no llega.
 */
export interface IConfigEntornoCron {
    hostname: string;
}

/**
 * Configuración de {@link horaProgramadaDeJob}.
 *
 * @property job - Nombre del Job.
 * @property cronjob - Nombre del CronJob, o `''` si no se conoce.
 * @property inicio - Epoch ms del arranque del proceso.
 * @property plazoInicioS - `startingDeadlineSeconds`, o `null` (se supone 3600 s).
 * @property plazoEjecucionS - `activeDeadlineSeconds`, o `null` (se supone 24 h).
 */
export interface IConfigHoraProgramada {
    job: string;
    cronjob: string;
    inicio: number;
    plazoInicioS: number|null;
    plazoEjecucionS: number|null;
}

/**
 * Configuración de {@link construirEjecucion}.
 *
 * @property env - Variables de entorno.
 * @property hostname - `os.hostname()`.
 * @property carga - Carga del pod (`cronjob` o `job`).
 * @property inicio - Epoch ms del arranque del proceso.
 */
export interface IConfigEjecucion {
    env: Record<string, string|undefined>;
    hostname: string;
    carga: TCargaPod;
    inicio: number;
}

/** Longitudes máximas del contrato (`IHeartbeatEjecucion`). */
const MAX_JOB = 63;
const MAX_UID = 36;
const MAX_PROGRAMACION = 100;
const MAX_ZONA = 64;
const MAX_INDICE = 65535;

/** Margen en ms con el que la hora programada puede ser posterior al arranque (relojes desfasados). */
const MARGEN_RELOJ_MS = 60_000;

/** Valores por defecto de Kubernetes para cuando no llegan los plazos: `startingDeadlineSeconds` (1 h) y un día de ejecución. */
const PLAZO_INICIO_S_POR_DEFECTO = 3600;
const PLAZO_EJECUCION_S_POR_DEFECTO = 86400;

const CONCURRENCIAS: TConcurrenciaCron[] = ["Allow", "Forbid", "Replace"];

/** El pod de un Job lleva su nombre más `-` y 5 caracteres aleatorios. */
const FORMATO_HOSTNAME_JOB = /^(.+)-[a-z0-9]{5}$/;

/**
 * Carga de un pod según su tipo de despliegue del manifest (`pod.tipo`); nunca según la programación.
 */
export function cargaDePod(tipo: string): TCargaPod {
    switch (tipo) {
        case "cronjob":
            return "cronjob";
        case "job":
            return "job";
        default:
            return "service";
    }
}

/**
 * Si la carga termina por sí sola (`cronjob` y `job`): en ella `listo` significa «en curso».
 */
export function esCargaFinita(carga: TCargaPod): boolean {
    return carga !== "service";
}

function cadena(valor: string|undefined, max: number): string|null {
    const recortada = (valor ?? "").trim().slice(0, max);

    return recortada.length > 0 ? recortada : null;
}

function entero(valor: string|undefined): number|null {
    const texto = (valor ?? "").trim();
    if (!/^\d{1,15}$/.test(texto)) {
        return null;
    }

    return Number(texto);
}

/** Un entero decimal sin signo ni decimales de 0 a 65535 (lo que cabe en `SMALLINT UNSIGNED`); lo demás es `null`. */
function indiceDeJob(valor: string|undefined): number|null {
    const texto = (valor ?? "").trim();
    if (!/^\d{1,5}$/.test(texto)) {
        return null;
    }
    const numero = Number(texto);

    return numero <= MAX_INDICE ? numero : null;
}

/**
 * El nombre del Job que sale del hostname del pod. Un pod de un Job normal lleva el nombre del Job más `-` y 5 caracteres aleatorios; el de un Job **Indexed** se llama `<job>-<índice>`, que no
 * casa con eso, y sin quitar ese sufijo cada índice parecería un Job (y un CronJob) distinto. Sin `indice`, solo vale la forma de siempre.
 */
function jobDeHostname(hostname: string, indice: number|null): string {
    const sufijo = `-${indice}`;
    if (indice !== null && hostname.length > sufijo.length && hostname.endsWith(sufijo)) {
        return hostname.slice(0, -sufijo.length);
    }

    return FORMATO_HOSTNAME_JOB.exec(hostname)?.[1] ?? hostname;
}

/**
 * Lo que dice el entorno del pod sobre su ejecución. Todo puede faltar; nada lanza. Las cadenas se recortan a su máximo del contrato.
 */
export function leerEntornoCron(env: Record<string, string|undefined>, {hostname}: IConfigEntornoCron): IEntornoCron {
    const concurrencia = (env["CRON_CONCURRENCIA"] ?? "").trim();
    const indice = indiceDeJob(env["JOB_COMPLETION_INDEX"]);
    const deHostname = jobDeHostname(hostname, indice);

    return {
        job: cadena(env["POD_JOB"], MAX_JOB) ?? deHostname.slice(0, MAX_JOB),
        jobUid: cadena(env["POD_JOB_UID"], MAX_UID) ?? "",
        cronjob: cadena(env["CRON_NOMBRE"], MAX_JOB) ?? "",
        indice,
        programacion: cadena(env["CRON_SCHEDULE"], MAX_PROGRAMACION),
        zonaHoraria: cadena(env["CRON_TIMEZONE"], MAX_ZONA),
        concurrencia: (CONCURRENCIAS as string[]).includes(concurrencia) ? concurrencia as TConcurrenciaCron : null,
        plazoInicioS: entero(env["CRON_PLAZO_INICIO_S"]),
        plazoEjecucionS: entero(env["CRON_PLAZO_EJECUCION_S"]),
    };
}

/**
 * Hora programada de un Job de CronJob, que Kubernetes pone en su nombre: `<cronjob>-<minutos desde epoch>`.
 *
 * Con `cronjob` el nombre debe ser exactamente `<cronjob>-<7 a 10 dígitos>`; sin él, `<algo>-<8 a 10 dígitos>`. Un Job lanzado a mano
 * (`kubectl create job`) con otro nombre da `null`, y también un número que no encaja en el tiempo: la hora no puede ser posterior al
 * arranque del pod (salvo 60 s de desfase de relojes) ni anterior en más de `plazoInicioS + plazoEjecucionS`, que es lo más que puede
 * tardar un Job en arrancar un pod, incluidos los reintentos de `backoffLimit`.
 *
 * @returns Epoch ms, o `null` si el Job no es de una hora programada.
 */
export function horaProgramadaDeJob({job, cronjob, inicio, plazoInicioS, plazoEjecucionS}: IConfigHoraProgramada): number|null {
    let numero: string|undefined;
    if (cronjob.length > 0) {
        const escapado = cronjob.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        numero = new RegExp(`^${escapado}-(\\d{7,10})$`).exec(job)?.[1];
    } else {
        numero = /^.+-(\d{8,10})$/.exec(job)?.[1];
    }
    if (numero === undefined) {
        return null;
    }

    const programada = Number(numero) * 60_000;
    const tarde = ((plazoInicioS ?? PLAZO_INICIO_S_POR_DEFECTO) + (plazoEjecucionS ?? PLAZO_EJECUCION_S_POR_DEFECTO)) * 1000;
    if (programada > inicio + MARGEN_RELOJ_MS || inicio - programada > tarde) {
        return null;
    }

    return programada;
}

/**
 * La ejecución del pod para el heartbeat, con `resultado` y `error` a `null` (los pone la despedida). El nombre del CronJob es
 * `CRON_NOMBRE` o, si falta, el prefijo del nombre del Job antes de `-<número>` cuando el nombre tiene esa forma, o si no el nombre del
 * propio Job. **Nunca vacío**: el receptor rechaza el latido entero con un `cronjob` vacío, y con él se perdería el resultado. La hora
 * programada de un `job` es siempre `null`: lo lanza una persona, y su `CRON_SCHEDULE` es una fecha imposible de relleno.
 */
export function construirEjecucion({env, hostname, carga, inicio}: IConfigEjecucion): IHeartbeatEjecucion {
    const entorno = leerEntornoCron(env, {hostname});
    const cronjob = entorno.cronjob.length > 0 ? entorno.cronjob : (/^(.+)-\d{7,10}$/.exec(entorno.job)?.[1] ?? entorno.job).slice(0, MAX_JOB);

    return {
        job: entorno.job,
        jobUid: entorno.jobUid,
        cronjob,
        indice: entorno.indice,
        programada: carga === "job" ? null : horaProgramadaDeJob({job: entorno.job, cronjob: entorno.cronjob, inicio, plazoInicioS: entorno.plazoInicioS, plazoEjecucionS: entorno.plazoEjecucionS}),
        programacion: entorno.programacion,
        zonaHoraria: entorno.zonaHoraria,
        concurrencia: entorno.concurrencia,
        plazoInicioS: entorno.plazoInicioS,
        plazoEjecucionS: entorno.plazoEjecucionS,
        resultado: null,
        error: null,
    };
}
