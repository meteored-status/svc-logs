/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 25 Jun 2026 06:52:42 GMT
 * Hash: 57cb194337c88e0adcf162eee965686f
 * Versión: 2026.6.25+5-josantoniojimnez
 * Anterior: 2026.6.25+4-josantoniojimnez
 */

import {spawn as spawnProcess} from "node:child_process";

import {Deferred} from "services-comun/modules/utiles/promise";

import {Colors} from "./colors";
import {Log} from "./log";

/**
 * Ejecuta `yarn run patch:apply` en la raíz del monorepo mostrando la salida en tiempo real.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export function aplicarPatches(basedir: string): Promise<void> {
    const deferred = new Deferred<void>();
    Log.info({type: Log.label_base, label: "patches"}, Colors.colorize([Colors.FgCyan, Colors.Bright], "Aplicando patches"));
    spawnProcess("yarn", ["run", "patch:apply"], {cwd: basedir, stdio: "inherit", shell: process.platform === "win32"})
        .on("error", (err) => { deferred.reject(err); })
        .on("close", (status) => {
            if ((status ?? 0) !== 0) {
                deferred.reject(new Error(`patch:apply terminó con código ${status}`));
            } else {
                deferred.resolve();
            }
        });
    return deferred.promise;
}

