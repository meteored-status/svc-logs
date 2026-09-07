/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 7797beb3ca988899c30619ce1f2fee94
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Fork de `services-comun/modules/utiles/fs.ts`, con solo las funciones
 * (`isDir`, `isFile`, `md5Dir`, `mkdir`, `readDir`, `readFile`, `readFileBuffer`,
 * `readFileString`, `readJSON`, `readJSONSync`, `rmdir`, `safeWrite`, `unlink`) que usan
 * las herramientas de línea de comandos del monorepo: `mrpack` (`@mr/cli`) y `mrlang`
 * (`@mr/core-i18n`).
 *
 * El original importa `error`/`warning` de `./log`, que a su vez depende de `dd-trace`.
 * Este fork usa en su lugar el logger de al lado (`./log`), evitando arrastrar `dd-trace`
 * al bundle de las CLI a través de esta ruta.
 */

import path from "node:path";
import fs, {readFileSync, type PathLike, type PathOrFileDescriptor} from "node:fs";
import {createHash} from "node:crypto";
import {mkdir as mkdirOriginal, readdir, readFile, rename as renameOriginal, rm, stat, type FileHandle} from "node:fs/promises";

import {error} from "./log";

const LETRAS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Hash MD5 hexadecimal de una cadena.
 *
 * Copia local de `services-comun/modules/utiles/hash::md5`, que es la única de las tres funciones
 * de aquel módulo que se usa. Está aquí, y no importada, para que este paquete no dependa de
 * `services-comun`: es una línea sobre `node:crypto`, y la dependencia costaba más de lo que
 * ahorraba.
 */
function md5(entrada: string): string {
    return createHash("md5").update(entrada).digest("hex");
}

/**
 * Cadena aleatoria de `chars` caracteres alfanuméricos, para el nombre del fichero temporal de
 * `safeWrite()`.
 *
 * Copia local de `services-comun/modules/utiles/random::random`, **con un desvío deliberado**: el
 * original hace `Math.round(Math.random()*62)` sobre un alfabeto de 62 caracteres, así que el
 * índice 62 se sale y `charAt` devuelve `""`. El resultado es que de vez en cuando la cadena sale
 * más corta de lo pedido —y, con el redondeo, el primer y el último carácter salen la mitad de
 * veces que el resto—. Aquí se usa para nombrar ficheros temporales, donde lo que importa es no
 * colisionar, así que la copia usa `Math.floor` y devuelve siempre `chars` caracteres
 * equiprobables.
 */
function random(chars: number = 8): string {
    let salida = "";
    for (let i = 0; i < chars; i++) {
        salida += LETRAS.charAt(Math.floor(Math.random()*LETRAS.length));
    }

    return salida;
}

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
