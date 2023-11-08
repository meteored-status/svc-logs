import {spawn} from "node:child_process";

import {Colors} from "./colors";
import {Comando} from "./comando";
import {readFileBuffer, readFileString, safeWrite, unlink} from "../../../modules/utiles/fs";

interface IYarnConfig {
    verbose?: boolean;
}

export class Yarn {
    /* STATIC */
    public static async update(basedir: string): Promise<void> {
        console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Actualizando YARN"));
        console.group();
        const {anterior, nueva} = await this.updateBase(basedir);
        const cambio = anterior!=nueva;
        let instalar: boolean = cambio;

        if (cambio) {
            await safeWrite(`${basedir}/${anterior}`, await readFileBuffer(`${basedir}/${nueva}`));
            Colors.resetNext();
        //     console.group();
        //     await Promise.all([
        //         this.updatePlugin(basedir, "interactive-tools"),
        //         this.updatePlugin(basedir, "typescript"),
        //         this.updatePlugin(basedir, "workspace-tools"),
        //     ]);
        //     console.groupEnd();
        //     Colors.resetNext();
        //     instalar = true;
        // } else {
        //     const plugins: Promise<void>[] = [];
        //     const rc = await readFileString(`${basedir}/.yarnrc.yml`);
        //     Colors.resetNext();
        //     console.group();
        //     if (!rc.includes("interactive-tools")) {
        //         plugins.push(this.updatePlugin(basedir, "interactive-tools"));
        //     }
        //     if (!rc.includes("typescript")) {
        //         plugins.push(this.updatePlugin(basedir, "typescript"));
        //     }
        //     if (!rc.includes("workspace-tools")) {
        //         plugins.push(this.updatePlugin(basedir, "workspace-tools"));
        //     }
        //     if (plugins.length>0) {
        //         instalar = true;
        //         await Promise.all(plugins);
        //         console.groupEnd();
        //         Colors.resetNext();
        //     } else {
        //         instalar = false;
        //         console.groupEnd();
        //     }
        }
        console.groupEnd();
        if (instalar) {
            await this.install(basedir, {verbose:false});
        }


        const lock1 = await readFileString(`${basedir}/yarn.lock`);
        const status = await this.upgrade(basedir);
        const lock2 = await readFileString(`${basedir}/yarn.lock`);

        if (status==0 && (cambio || lock1!=lock2)) {
            await this.install(basedir, {verbose:false});
        }

        if (cambio) {
            await unlink(`${basedir}/${anterior}`);
        }
    }

    private static async getPath(basedir: string): Promise<string> {
        const data = await readFileString(`${basedir}/.yarnrc.yml`);
        return data.split("yarnPath:").at(1)?.trim()??"0.0.0";
    }

    private static async updateBase(basedir: string): Promise<{anterior: string, nueva: string}> {
        console.log(Colors.colorize([Colors.FgWhite], "Versión de Yarn"));
        console.group();
        const anterior = await this.getPath(basedir);
        const {status, stderr} = await Comando.spawn("yarn", ["set", "version", "latest"], {cwd: basedir});
        if (status!=0) {
            console.error(Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR"));
            console.error(stderr);

            console.groupEnd();
            return Promise.reject();
        }

        const nueva = await this.getPath(basedir);
        const version = nueva.split("/").at(-1)?.split("-").at(-1)?.split(".").slice(0,3).join(".")??"0.0.0";
        if (anterior!=nueva) {
            console.log(`${Colors.colorize([Colors.FgGreen], version)} (Nueva versión)`);
        } else {
            console.log(`${Colors.colorize([Colors.FgBlue], version)} (Sin cambios)`);
        }

        console.groupEnd();
        return {anterior, nueva};
    }

    // private static async updatePlugin(basedir: string, plugin: string): Promise<void> {
    //     const color = Colors.nextColor();
    //     console.log(Colors.colorize([Colors.FgWhite], "Instalando plugin"), Colors.colorize(color, plugin));
    //     const {status, stdout, stderr} = await Comando.spawn("yarn", ["plugin", "import", plugin], {cwd: basedir});
    //     if (status!=0) {
    //         console.log(Colors.colorize([Colors.FgWhite], "Instalando plugin"), Colors.colorize(color, plugin), "=>", `[${Colors.colorize([Colors.FgRed], "ERROR")}]`);
    //         return Promise.reject();
    //     }
    //     console.log(Colors.colorize([Colors.FgWhite], "Instalando plugin"), Colors.colorize(color, plugin), "=>", `[${Colors.colorize([Colors.FgGreen], "OK   ")}]`);
    // }

    public static async install(basedir: string, {verbose}: IYarnConfig = {}): Promise<void> {
        // clean ??= false;
        verbose ??= true;
        console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Reinstalando dependencias"));
        console.group();

        {
            const {status, stdout, stderr} = await Comando.spawn("yarn", ["install"], {
                cwd: basedir,
            });
            if (status != 0) {
                // if (clean && await isFile(`${basedir}/tmp/yarn.lock`)) {
                //     console.error(`[${Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR")}] => ${Colors.colorize([Colors.FgMagenta, Colors.Bright], "Rollback")}`);
                //     if (await isFile(`${basedir}/yarn.lock`)) {
                //         await unlink(`${basedir}/yarn.lock`);
                //     }
                //     await rename(`${basedir}/tmp/yarn.lock`, `${basedir}/yarn.lock`);
                //     console.groupEnd();
                //     return this.install(basedir, {verbose});
                // }

                console.error(`[${Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR")}]`);
                console.log(stderr);
                console.groupEnd();
                return Promise.reject();
            }
            if (verbose) {
                console.log(stdout);
            }
        }

        {
            console.log("Optimizando dependencias");
            const {status, stdout} = await Comando.spawn("yarn", ["dedupe", "--strategy", "highest"], {
                cwd: basedir,
            });
            if (status == 0) {
                console.error(`[${Colors.colorize([Colors.FgGreen, Colors.Bright], "OK   ")}]`);
            } else {
                console.error(`[${Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR")}]`);
            }
            if (verbose) {
                console.log(stdout);
            }
        }

        console.groupEnd();
    }

    private static async upgrade(basedir: string): Promise<number> {
        console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Actualizando dependencias"));
        console.group();
        return new Promise<number>((resolve)=>{
            spawn("yarn", ["upgrade-interactive",], {cwd: basedir, shell: true, stdio: [process.stdin,process.stdout,process.stderr]})
                .on("error", (err)=>{
                    console.error("Error actualizando dependencias", err)
                })
                .on("close", (status)=>{
                    console.groupEnd();
                    resolve(status??0);
                });
        });
    }

    /* INSTANCE */
}
