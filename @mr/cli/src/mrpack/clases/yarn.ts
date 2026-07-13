/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 25 Jun 2026 06:52:42 GMT
 * Hash: e0cb0de181d5fe441881e1bb604ca1f0
 * Versión: 2026.6.25+5-josantoniojimnez
 * Anterior: 2026.6.25+4-josantoniojimnez
 */

import {spawn as spawnProcess} from "node:child_process";

import {Deferred} from "services-comun/modules/utiles/promise";
import {readFileBuffer, readFileString, safeWrite, unlink} from "services-comun/modules/utiles/fs";

import {Colors} from "./colors";
import {Comando} from "./comando";
import {Log} from "./log";

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
    Log.group({type: Log.label_base, label: "yarn"}, Colors.colorize([Colors.FgWhite], "Versión de Yarn"));
    const anterior = await getPath(basedir);
    const {status, stderr} = await Comando("yarn", ["set", "version", "latest"], {cwd: basedir});
    if (status!=0) {
        Log.error({type: Log.label_base, label: "yarn"}, Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR"), stderr);

        Log.groupEnd();
        return Promise.reject();
    }

    const nueva = await getPath(basedir);
    const version = nueva.split("/").at(-1)?.split("-").at(-1)?.split(".").slice(0,3).join(".")??"0.0.0";
    if (anterior!=nueva) {
        Log.info({type: Log.label_base, label: "yarn"}, `${Colors.colorize([Colors.FgGreen], version)} (Nueva versión)`);
    } else {
        Log.info({type: Log.label_base, label: "yarn"}, `${Colors.colorize([Colors.FgBlue], version)} (Sin cambios)`);
    }

    Log.groupEnd();
    return {anterior, nueva};
}

async function upgrade(basedir: string): Promise<number> {
    Log.group({type: Log.label_base, label: "yarn"}, Colors.colorize([Colors.FgCyan, Colors.Bright], "Actualizando dependencias"));
    const deferred = new Deferred<number>();
    spawnProcess("yarn", ["upgrade-interactive"], {cwd: basedir, shell: process.platform === "win32", stdio: "inherit"})
        .on("error", (err) => {
            Log.error({type: Log.label_base, label: "yarn"}, "Error actualizando dependencias", err);
            deferred.resolve(1);
        })
        .on("close", (status) => {
            Log.groupEnd();
            deferred.resolve(status ?? 0);
        });
    return deferred.promise;
}

export async function update(basedir: string, doInstall: boolean): Promise<void> {
    Log.group({type: Log.label_base, label: "yarn"}, Colors.colorize([Colors.FgCyan, Colors.Bright], "Actualizando YARN"));
    const {anterior, nueva} = await updateBase(basedir);
    const cambio = anterior!=nueva;
    const instalar = cambio || doInstall;

    if (cambio) {
        await safeWrite(`${basedir}/${anterior}`, await readFileBuffer(`${basedir}/${nueva}`));
        Colors.resetNext();
    }
    Log.groupEnd();
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
    Log.group({type: Log.label_base, label: "yarn"}, Colors.colorize([Colors.FgCyan, Colors.Bright], "Reinstalando dependencias"));

    if (doInstall) {
        const {status, stdout, stderr} = await Comando("yarn", ["install"], {
            cwd: basedir,
        });
        if (status != 0) {
            Log.error({type: Log.label_base, label: "yarn"}, `[${Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR")}]`, stderr);
            Log.groupEnd();
            return Promise.reject();
        }
        if (verbose) {
            Log.info({type: Log.label_base, label: "yarn"}, stdout);
        }
    }

    if (optimize) {
        Log.info({type: Log.label_base, label: "yarn"}, "Optimizando dependencias");
        const {status, stdout} = await Comando("yarn", ["dedupe", "--strategy", "highest"], {
            cwd: basedir,
        });
        if (status == 0) {
            Log.info({type: Log.label_base, label: "yarn"}, `[${Colors.colorize([Colors.FgGreen, Colors.Bright], "OK   ")}]`);
        } else {
            Log.error({type: Log.label_base, label: "yarn"}, `[${Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR")}]`);
        }
        if (verbose) {
            Log.info({type: Log.label_base, label: "yarn"}, stdout);
        }
    }

    Log.groupEnd();
}
