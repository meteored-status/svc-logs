/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: af68b54bdf493d155c063c8684192f43
 * Versión: 2026.5.27+1-josantoniojimnez
 * Anterior: 2026.5.21+1-josantoniojimnez
 */

import {spawn as spawnProcess} from "node:child_process";

import {Deferred} from "services-comun/modules/utiles/promise";

interface IComandoConfig {
    cwd?: string;
    env?: Record<string, string>;
    shell?: boolean|string;
    colores?: boolean;
}

/**
 * Resultado de ejecutar un comando del sistema.
 *
 * @property status - Código de salida del proceso (0 = éxito).
 * @property stdout - Salida estándar capturada.
 * @property stderr - Salida de error capturada.
 */
export interface IComandoSalida {
    status: number;
    stdout: string;
    stderr: string;
}

export async function Comando(comando: string, params: string[] = [], config: IComandoConfig = {}): Promise<IComandoSalida> {
    const {cwd, env = {}, shell = false, colores = true} = config;
    const proceso = spawnProcess(comando, params, {
        cwd,
        env: {
            ...process.env,
            ...env,
            ...colores?{
                FORCE_COLOR: "1",
            }:{},
        },
        stdio: "pipe",
        shell,
    });

    const stdout: string[] = [];
    proceso.stdout.on("data", (data)=>{
        stdout.push(data.toString("utf-8"));
    });
    const stderr: string[] = [];
    proceso.stderr.on("data", (data)=>{
        stderr.push(data.toString("utf-8"));
    });

    const deferred = new Deferred<IComandoSalida>();
    proceso.on("error", (err)=>{
        deferred.reject(err);
    });
    proceso.on("close", (status)=>{
        deferred.resolve({
            status: status??0,
            stdout: stdout.join(""),
            stderr: stderr.join(""),
        });
    });

    return deferred.promise;
}
