/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: f8c1b42796829afe0d950752362e4c1e
 * Versión: 2026.5.27+1-josantoniojimnez
 * Anterior: 2026.5.21+4-josantoniojimnez
 */

import {spawn} from "node:child_process";

import {Deferred} from "services-comun/modules/utiles/promise";
import {isFile, md5Dir, mkdir, readFileString, safeWrite} from "services-comun/modules/utiles/fs";

import {Colors} from "../colors";
import {Comando} from "../comando";
import {Paquete, PaqueteTipo} from "../paquete";
import {install} from "../yarn";

/**
 * Configuración de {@link recompilarCliente}.
 *
 * @property reiniciar    - Si `true` (por defecto), reinicia el proceso tras recompilar.
 * @property skipInstall  - Si `true`, omite el `yarn install` previo a la compilación.
 */
interface IRecompilarClienteConfig {
    reiniciar?: boolean;
    skipInstall?: boolean;
}

export async function add(basedir: string, frameworks: string[]): Promise<boolean> {
    let cambio = false;

    for (const fw of frameworks) {
        let tipo: PaqueteTipo;
        let npmName: string;
        let localDir: string;

        if (fw.startsWith("@mr/core/")) {
            const name = fw.slice("@mr/core/".length);
            tipo = PaqueteTipo.core;
            npmName = `@mr/core-${name}`;
            localDir = `${basedir}/@mr/core/${name}`;
        } else if (fw.startsWith("@mr/user/")) {
            const name = fw.slice("@mr/user/".length);
            tipo = PaqueteTipo.user;
            npmName = `@mr/user-${name}`;
            localDir = `${basedir}/@mr/user/${name}`;
        } else {
            tipo = PaqueteTipo.legacy;
            npmName = fw;
            localDir = `${basedir}/framework/${fw}`;
        }

        if (await isFile(`${localDir}/package.json`)) {
            continue;
        }

        console.log(`Añadiendo framework ${Colors.colorize([Colors.FgMagenta], fw)}...`);
        await mkdir(localDir, true);
        await safeWrite(`${localDir}/package.json`, `${JSON.stringify({
            name: npmName,
            version: "0.0.0+0-new",
            config: {
                subible: true,
                tipo,
            },
        }, null, 2)}\n`);
        if (await pullPackage(localDir, true)) {
            cambio = true;
        }
    }

    return cambio;
}

export async function remove(_basedir: string, _frameworks: string[]): Promise<boolean> {
    return false;
}

export async function getClienteHash(basedir: string): Promise<string> {
    return readFileString(`${basedir}/@mr/cli/bin/hash.md5`).catch(() => "");
}

export async function getClienteMD5(basedir: string): Promise<string> {
    return md5Dir(`${basedir}/@mr/cli/bin/min`);
}

/**
 * Devuelve el hash anterior si el cliente está desactualizado, o `undefined` si está al día.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @returns Hash md5 almacenado en `bin/hash.md5` si difiere del actual, o `undefined`.
 */
export async function checkCliente(basedir: string): Promise<string | undefined> {
    if (await isFile(`${basedir}/@mr/cli/bin/hash.md5`)) {
        const [hash, md5] = await Promise.all([
            getClienteHash(basedir),
            getClienteMD5(basedir),
        ]);
        if (hash != md5) {
            return hash;
        }
    }

    return undefined;
}

export async function recompilarCliente(basedir: string, hash: string, config: IRecompilarClienteConfig = {}): Promise<void> {
    const {reiniciar = true, skipInstall = false} = config;
    if (!skipInstall) {
        await install(basedir, {verbose: false, optimize: true});
    }

    console.log(Colors.colorize([Colors.FgGreen, Colors.Bright], "Compilando nueva versión del cliente"));
    await Comando("yarn", ["run", "compile"], {cwd: `${basedir}/@mr/cli`});
    const md5 = await md5Dir(`${basedir}/@mr/cli/bin/min`);
    await safeWrite(`${basedir}/@mr/cli/bin/hash.md5`, md5, true);

    if (md5 == hash || !reiniciar) {
        return;
    }

    console.log(Colors.colorize([Colors.FgYellow, Colors.Bright], "Reiniciando..."));
    console.groupEnd();
    console.log("");
    const child = spawn("yarn", ["mrpack", ...process.argv.slice(2)], {
        stdio: "inherit",
    });
    const promesa = new Deferred<number>();
    child.on("exit", (code) => {
        promesa.resolve(code ?? 0);
    });
    await promesa.promise;
    process.exit();
}

export async function getAutor(): Promise<string> {
    const {status, stdout} = await Comando("git", ["config", "user.name"]);
    if (status != 0) {
        console.log(Colors.colorize([Colors.FgRed], "No se puede obtener el usuario de git"));
        console.groupEnd();
        return Promise.reject();
    }
    return stdout.trim();
}

/**
 * Descarga y aplica la actualización de un paquete individual dado su directorio.
 * Usado internamente por `mrpack init` para bootstrap de paquetes de core.
 *
 * @param dir    - Ruta absoluta al directorio del paquete.
 * @param forzar - Si `true`, aplica la actualización sin confirmación interactiva.
 * @returns `true` si se aplicó algún cambio.
 */
export async function pullPackage(dir: string, forzar: boolean): Promise<boolean> {
    const paquete = await Paquete.build(dir);
    return paquete.pull(forzar);
}
