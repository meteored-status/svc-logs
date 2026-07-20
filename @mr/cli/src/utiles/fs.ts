/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 7deaf3cb4a5cc54a9fd9670c9d4b1f0d
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

/**
 * Fork local de `services-comun/modules/utiles/fs.ts`, con solo las funciones
 * (`isDir`, `isFile`, `md5Dir`, `mkdir`, `readDir`, `readFile`, `readFileBuffer`,
 * `readFileString`, `readJSON`, `readJSONSync`, `rmdir`, `safeWrite`, `unlink`) que usa
 * el código propio de `@mr/cli` (`mrpack`/`mrlang`).
 *
 * El original importa `error`/`warning` de `./log`, que a su vez depende de `dd-trace`.
 * Este fork usa en su lugar el logger local de `@mr/cli` (`./log`), evitando arrastrar
 * `dd-trace` al bundle de la CLI a través de esta ruta.
 */

import path from "node:path";
import fs, {readFileSync, type PathLike, type PathOrFileDescriptor} from "node:fs";
import {mkdir as mkdirOriginal, readdir, readFile, rename as renameOriginal, rm, stat, type FileHandle} from "node:fs/promises";

import {md5} from "services-comun/modules/utiles/hash";
import {random} from "services-comun/modules/utiles/random";

import {error} from "./log";

async function exists(file: PathLike): Promise<boolean> {
    return new Promise<boolean>((resolve)=>{
        fs.access(file, fs.constants.F_OK, (err)=>{
            resolve(!err);
        });
    });
}

export {
    readdir as readDir,
    readFile,
};

export async function readFileBuffer(file: PathLike | FileHandle): Promise<Buffer> {
    return readFile(file);
}

export async function readFileString(file: PathLike | FileHandle): Promise<string> {
    const data = await readFile(file);
    return data.toString("utf-8");
}

export async function readJSON<T=any>(file: PathLike | FileHandle): Promise<T> {
    try {
        const buffer = await readFileString(file);
        return JSON.parse(buffer);
    } catch (e) {
        return Promise.reject(e);
    }
}

export function readJSONSync<T=any>(file: PathOrFileDescriptor): T|null {
    try {
        return JSON.parse(readFileSync(file).toString("utf-8")) as T;
    } catch (e) {
        return null;
    }
}

export async function isDir(dir: PathLike): Promise<boolean> {
    try {
        const stats = await stat(dir);
        if (stats.isDirectory()) {
            return true;
        }
    } catch (e) {}

    return false;
}

export async function isFile(file: PathLike): Promise<boolean> {
    try {
        const stats = await stat(file);
        if (stats.isFile()) {
            return true;
        }
    } catch (e) {}

    return false;
}

export async function mkdir(dir: PathLike): Promise<void> {
    await mkdirOriginal(dir, {
        recursive: true
    });
}

async function rename(antiguo: PathLike, nuevo: PathLike): Promise<boolean> {
    return renameOriginal(antiguo, nuevo)
        .then(()=>true)
        .catch(()=>false);
}

export async function rmdir(path: PathLike): Promise<void> {
    await rm(path, {
        recursive: true,
        force: true,
    });
}

async function overwrite(oldPath: PathLike, newPath: PathLike, sobreescribir: boolean): Promise<boolean> {
    if (!sobreescribir) {
        if (await exists(newPath)) {
            await unlink(oldPath);
            return false;
        }
    }
    if (!await rename(oldPath, newPath)) {
        await unlink(oldPath);
    }
    return true;
}

export async function safeWrite(local: PathLike, data: string|Buffer, sobreescribir: boolean=false, excepcion: boolean=false): Promise<boolean> {
    const rnd = `${local}.${random()}`;
    return new Promise<boolean>((resolve, reject)=>{
        fs.writeFile(rnd, data, {
            flag: "wx",
        }, (err: NodeJS.ErrnoException | null)=>{
            if (!err) {
                overwrite(rnd, local, sobreescribir).then((ok: boolean)=>{
                    if (ok) {
                        resolve(true);
                    } else if (!excepcion) {
                        resolve(false);
                    } else {
                        reject(new Error("No se pudo renombrar el archivo temporal al final"));
                    }
                });
            } else if (!excepcion) {
                error("Error en safeWrite", rnd, err);
                resolve(false);
            } else {
                reject(new Error("No se pudo escribir archivo temporal"));
            }
        });
    });
}

export async function unlink(file: PathLike): Promise<void> {
    if (await isFile(file)) {
        await new Promise<void>((resolve, reject) => {
            fs.unlink(file, (err: NodeJS.ErrnoException|null)=>{
                if (!err) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    } else if (await isDir(file)) {
        await rmdir(file);
    }
}

async function md5DirExec(dir: string): Promise<string> {
    const salida = [
        md5(path.basename(dir)),
    ];

    if (await isFile(dir)) {
        salida.push(md5(await readFileString(dir)));
    } else if (await isDir(dir)) {
        for (const actual of await readdir(dir)) {
            const name = `${dir}/${actual}`;
            if (await isDir(name)) {
                salida.push(await md5Dir(name));
            } else if (await isFile(name)) {
                salida.push(md5(actual));
                salida.push(md5(await readFileString(name)));
            }
        }
    }
    return salida.join("");
}

export async function md5Dir(dir: string): Promise<string> {
    if (!await isFile(dir) && !await isDir(dir)) {
        return "";
    }
    const salida = await md5DirExec(dir);
    if (salida.length!==32) {
        return md5(salida);
    }
    return salida;
}
