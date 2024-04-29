import {spawn} from "node:child_process";

interface IComandoConfig {
    cwd?: string;
    env?: Record<string, string>;
    shell?: boolean|string;
}

interface IComandoSalida {
    status: number;
    stdout: string;
    stderr: string;
}

export class Comando {
    /* STATIC */
    public static async spawn(comando: string, params: string[] = [], {cwd, env={}, shell=true}: IComandoConfig = {}): Promise<IComandoSalida> {
        const proceso = spawn(comando, params, {
            cwd,
            env: {
                ...process.env,
                ...env,
                FORCE_COLOR: "1",
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

        return new Promise<IComandoSalida>((resolve)=>{
            proceso.on("close", (status)=>{
                resolve({
                    status: status??0,
                    stdout: stdout.join(""),
                    stderr: stderr.join(""),
                });
            });
        });
    }

    /* INSTANCE */
}
