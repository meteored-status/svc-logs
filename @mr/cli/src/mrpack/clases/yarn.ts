/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: a25e2b268ced9e5ae425dfe6185420d5
 */

import {spawn as spawnProcess} from "node:child_process";

import {readFileBuffer, readFileString, safeWrite, unlink} from "services-comun/modules/utiles/fs";

import {Colors} from "./colors";
import {Comando} from "./comando";

interface IYarnConfig {
    install?: boolean;
    optimize?: boolean;
    verbose?: boolean;
}

async function getPath(basedir: string): Promise<string> {
    const data = await readFileString(`${basedir}/.yarnrc.yml`);
    return data.split("yarnPath:").at(1)?.trim()??"0.0.0";
}

async function updateBase(basedir: string): Promise<{anterior: string, nueva: string}> {
    console.log(Colors.colorize([Colors.FgWhite], "Versión de Yarn"));
    console.group();
    const anterior = await getPath(basedir);
    const {status, stderr} = await Comando("yarn", ["set", "version", "latest"], {cwd: basedir});
    if (status!=0) {
        console.error(Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR"));
        console.error(stderr);

        console.groupEnd();
        return Promise.reject();
    }

    const nueva = await getPath(basedir);
    const version = nueva.split("/").at(-1)?.split("-").at(-1)?.split(".").slice(0,3).join(".")??"0.0.0";
    if (anterior!=nueva) {
        console.log(`${Colors.colorize([Colors.FgGreen], version)} (Nueva versión)`);
    } else {
        console.log(`${Colors.colorize([Colors.FgBlue], version)} (Sin cambios)`);
    }

    console.groupEnd();
    return {anterior, nueva};
}

async function upgrade(basedir: string): Promise<number> {
    console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Actualizando dependencias"));
    console.group();
    return new Promise<number>((resolve)=>{
        spawnProcess("yarn", ["upgrade-interactive"], {cwd: basedir, shell: false, stdio: "inherit"})
            .on("error", (err)=>{
                console.error("Error actualizando dependencias", err);
            })
            .on("close", (status)=>{
                console.groupEnd();
                resolve(status??0);
            });
    });
}

export async function update(basedir: string, doInstall: boolean): Promise<void> {
    console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Actualizando YARN"));
    console.group();
    const {anterior, nueva} = await updateBase(basedir);
    const cambio = anterior!=nueva;
    const instalar = cambio || doInstall;

    if (cambio) {
        await safeWrite(`${basedir}/${anterior}`, await readFileBuffer(`${basedir}/${nueva}`));
        Colors.resetNext();
    }
    console.groupEnd();
    if (instalar) {
        await install(basedir, {verbose:false});
    }

    const lock1 = await readFileString(`${basedir}/yarn.lock`);
    const status = await upgrade(basedir);
    const lock2 = await readFileString(`${basedir}/yarn.lock`);

    if (status==0 && (cambio || lock1!=lock2)) {
        await install(basedir, {verbose:false});
    }

    if (cambio) {
        await unlink(`${basedir}/${anterior}`);
    }
}

export async function install(basedir: string, {verbose, install: doInstall=true, optimize=true}: IYarnConfig = {}): Promise<void> {
    verbose ??= true;
    console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Reinstalando dependencias"));
    console.group();

    if (doInstall) {
        const {status, stdout, stderr} = await Comando("yarn", ["install"], {
            cwd: basedir,
        });
        if (status != 0) {
            console.error(`[${Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR")}]`);
            console.log(stderr);
            console.groupEnd();
            return Promise.reject();
        }
        if (verbose) {
            console.log(stdout);
        }
    }

    if (optimize) {
        console.log("Optimizando dependencias");
        const {status, stdout} = await Comando("yarn", ["dedupe", "--strategy", "highest"], {
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
