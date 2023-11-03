import os from "node:os";
import cluster from "node:cluster";

const KUBERNETES = process.env["KUBERNETES"]=="true";

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

export function info(...txt: any): void {
    if (txt.length>0) {
        console.info(ESTATICO, ...txt);
    } else if (!KUBERNETES) {
        console.info("");
    }
}

export function warning(...txt: any): void {
    if (txt.length>0) {
        console.warn(ESTATICO, ...txt);
    } else if (!KUBERNETES) {
        console.warn("");
    }
}

export function error(...txt: any): void {
    if (txt.length>0) {
        console.error(ESTATICO, ...txt);
    } else if (!KUBERNETES) {
        console.error("");
    }
}

export function debug(...txt: any): void {
    if (txt.length>0) {
        console.debug(ESTATICO, ...txt);
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
