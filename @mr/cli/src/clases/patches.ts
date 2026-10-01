/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 874b07fa82db486acf207d8a1ddf7673
 * Versión: 2026.9.23+2-bixus
 * Anterior: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {spawn as spawnProcess} from "node:child_process";

import {Deferred} from "services-comun/modules/utiles/promise";
import {Colors} from "@mr/core-cli/colors";

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

