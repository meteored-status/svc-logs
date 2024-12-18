import {spawn} from "node:child_process";

import {Deferred} from "services-comun/modules/utiles/promise";

interface IComandoConfig {
    cwd?: string;
    env?: Record<string, string>;
    shell?: boolean|string;
    colores?: boolean;
}

interface IComandoSalida {
    status: number;
    stdout: string;
    stderr: string;
}

export class Comando {
    /* STATIC */
    public static async spawn(comando: string, params: string[] = [], {cwd, env={}, shell=true, colores=true}: IComandoConfig = {}): Promise<IComandoSalida> {
        const proceso = spawn(comando, params, {
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
        proceso.on("close", (status)=>{
            deferred.resolve({
                status: status??0,
                stdout: stdout.join(""),
                stderr: stderr.join(""),
            });
        });

        return deferred.promise;
    }

    /* INSTANCE */
}
