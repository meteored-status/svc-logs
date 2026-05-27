/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 10:42:05 GMT
 * Hash: 25218fbf1372d6be8ba7c31b3dd66caf
 * Versión: 2026.5.18+2-josantoniojimnez
 */

import os from "node:os";
import cluster from "node:cluster";
import tracer from "dd-trace";
import {formats} from "dd-trace/ext";

const DATADOG = process.env["DATADOG"]=="true";
const KUBERNETES = process.env["KUBERNETES"]=="true";

/**
 * Mapeo de niveles internos a `severity` de Cloud Logging. Cuando los logs se
 * emiten como JSON, GKE/Cloud Logging usa el campo `severity` para clasificar
 * la entrada (`INFO`, `WARNING`, `ERROR`, `DEBUG`).
 */
const SEVERITY_GCP: Record<string, string> = {
    info: "INFO",
    warn: "WARNING",
    error: "ERROR",
    debug: "DEBUG",
};

function generarEstatico(): string {
    const worker = cluster.worker?.id;
    if (KUBERNETES) {
        const partes = os.hostname().split("-");
        const last = partes.pop();
        partes.pop(); // eliminamos el ID de despliegue
        if (worker==undefined) {
            return `[${partes.join("-")} ${last}]`;
        }
        return `[${partes.join("-")} ${last} {${worker}}]`;
    }

    if (worker==undefined) {
        return ``;
    }
    return ` {${worker}}`;
}

const ESTATICO = generarEstatico();

/**
 * Serializa un valor cualquiera a string de forma segura. Trata especialmente
 * los `Error` para preservar `message`, `name` y `stack`.
 */
function safeStringify(v: unknown): string {
    if (typeof v === "string") {
        return v;
    }
    if (v instanceof Error) {
        try {
            return JSON.stringify({name: v.name, message: v.message, stack: v.stack});
        } catch {
            return `${v.name}: ${v.message}`;
        }
    }
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}

/**
 * Construye un mensaje de log estructurado JSON compatible con Cloud Logging.
 * Cuando hay un span de dd-trace activo, inyecta el contexto de traza para que
 * Datadog y Cloud Logging puedan correlacionar el log con la traza.
 *
 * Si el primer argumento es un objeto plano (no `Error`), sus claves se
 * promueven al nivel raíz del payload (excepto las reservadas), lo que permite
 * llamar `info({event:"http.request", status:200, ...})` y obtener campos
 * indexables en lugar de un string opaco.
 */
function buildPayload(level: string, txt: any[]): string {
    const payload: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        severity: SEVERITY_GCP[level] ?? "INFO",
    };

    let head: unknown = txt[0];
    if (head !== null && typeof head === "object" && !(head instanceof Error) && !Array.isArray(head)) {
        for (const [k, v] of Object.entries(head as Record<string, unknown>)) {
            if (k === "timestamp" || k === "severity") {
                continue;
            }
            payload[k] = v;
        }
        if (txt.length > 1) {
            payload["message"] = txt.slice(1).map(safeStringify).join(" ");
        }
    } else {
        payload["message"] = txt.map(safeStringify).join(" ");
    }

    if (DATADOG) {
        const span = tracer.scope().active();
        if (span !== null) {
            tracer.inject(span.context(), formats.LOG, payload);
        }
    }

    return JSON.stringify(payload);
}

/**
 * Devuelve los argumentos finales con los que llamar a `console.*` para `level`.
 * En modo KUBERNETES se emite siempre JSON; en local se mantiene el prefijo
 * legible `ESTATICO + args` para no degradar la experiencia de desarrollo.
 */
function trace(txt: any[], level: string): any[] {
    if (KUBERNETES) {
        return [buildPayload(level, txt)];
    }
    if (DATADOG) {
        const span = tracer.scope().active();
        if (span!=null) {
            const traza = {
                time: new Date().toISOString(),
                level,
                message: txt.map(msg=>`${msg}`).join(" "),
            };
            tracer.inject(span.context(), formats.LOG, traza);
            return [JSON.stringify(traza)];
        }
    }

    return [ESTATICO, ...txt];
}

export function info(...txt: any): void {
    if (txt.length>0) {
        console.info(...trace(txt, "info"));
    } else if (!KUBERNETES) {
        console.info("");
    }
}

export function warning(...txt: any): void {
    if (txt.length>0) {
        console.warn(...trace(txt, "warn"));
    } else if (!KUBERNETES) {
        console.warn("");
    }
}

export function error(...txt: any): void {
    if (txt.length>0) {
        console.error(...trace(txt, "error"));
    } else if (!KUBERNETES) {
        console.error("");
    }
}

export function debug(...txt: any): void {
    if (txt.length>0) {
        if (KUBERNETES) {
            console.debug(...trace(txt, "debug"));
        } else {
            console.debug(ESTATICO, ...txt);
        }
    } else if (!KUBERNETES) {
        console.debug("");
    }
}

export function time(txt: string, previo: string=""): void {
    if (previo.length>0) {
        info(previo);
    }
    console.time(`${KUBERNETES?"":"                      "}=> ${txt}`);
}

export function timeEnd(txt: string): void {
    info(`Fin de proceso: `);
    console.timeEnd(`${KUBERNETES?"":"                      "}=> ${txt}`);
}

export function formatMemoria(memoria: number): string {
    let unidad: string = "B";
    if (Math.abs(memoria)>1024) {
        memoria = memoria/1024;
        unidad = "KB";
    }
    if (Math.abs(memoria)>1024) {
        memoria = memoria/1024;
        unidad = "MB";
    }
    if (Math.abs(memoria)>1024) {
        memoria = memoria/1024;
        unidad = "GB";
    }
    if (Math.abs(memoria)>1024) {
        memoria = memoria/1024;
        unidad = "TB";
    }

    return `${memoria.toFixed(2)}${unidad}`;
}

export function formatTiempo(ms: number): string {
    let annos = 0;
    let meses = 0;
    let dias = 0;
    let horas = 0;
    let minutos = 0;
    let segundos = 0;
    ms = Math.floor(ms);
    if (ms>1000) {
        segundos = Math.floor(ms/1000);
        ms = ms%1000;
    }
    if (segundos>60) {
        minutos = Math.floor(segundos/60);
        segundos = segundos%60;
    }
    if (minutos>60) {
        horas = Math.floor(minutos/60);
        minutos = minutos%60;
    }
    if (horas>24) {
        dias = Math.floor(horas/24);
        horas = horas%24;
    }
    if (dias>365) {
        annos = Math.floor(dias/365);
        dias = dias%365;
    }
    if (dias>30) {
        meses = Math.floor(dias/30);
        dias = dias%30;
    }

    const salida : string[] = [];
    if (annos>0) {
        salida.push(`${annos} año${annos==1?"":"s"}`);
    }
    if (meses>0) {
        salida.push(`${meses} mes${meses==1?"":"es"}`);
    }
    if (dias>0) {
        salida.push(`${dias} dia${dias==1?"":"s"}`);
    }
    if (horas>0) {
        salida.push(`${horas} hora${horas==1?"":"s"}`);
    }
    if (minutos>0) {
        salida.push(`${minutos} minuto${minutos==1?"":"s"}`);
    }
    if (segundos>0) {
        salida.push(`${segundos} segundo${segundos==1?"":"s"}`);
    }
    if (ms>0) {
        salida.push(`${ms} milisegundo${ms==1?"":"s"}`);
    }

    if (salida.length>0) {
        const ultimo = salida.pop() as string;
        if (salida.length>0) {
            return `${salida.join(", ")} y ${ultimo}`;
        }

        return ultimo;
    }

    return "0 milisegundos";
}
