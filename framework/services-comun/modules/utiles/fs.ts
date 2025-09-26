import path from "node:path";
import type {Readable} from "node:stream";
import fs, {existsSync, readFileSync, statSync, PathLike, PathOrFileDescriptor} from "node:fs";
import {mkdir as mkdirOriginal, readdir, readFile, rename as renameOriginal, rm, stat, FileHandle} from "node:fs/promises";

import {error, warning} from "./log";
import {md5} from "./hash";
import {pipeline} from "./stream";
import {random} from "./random";

export async function exists(file: PathLike): Promise<boolean> {
    return new Promise<boolean>((resolve)=>{
        fs.access(file, fs.constants.F_OK, (err)=>{
            resolve(!err);
        });
    });
}

export {
    readdir as readDir,
    readFile,
    stat as stats,
};

export async function readFileBuffer(file: PathLike | FileHandle): Promise<Buffer> {
    return readFile(file);
}

export async function readFileString(file: PathLike | FileHandle): Promise<string> {
    const data = await readFile(file);
    return data.toString("utf-8");
}

export async function fileSize(file: PathLike): Promise<number> {
    const stats = await stat(file);
    return stats.size;
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

export async function isDir(dir: PathLike, excepcion: boolean=false): Promise<boolean> {
    try {
        const stats = await stat(dir);
        if (stats.isDirectory()) {
            return true;
        }
    } catch (e) {}

    if (!excepcion) {
        return false;
    }

    return Promise.reject("Not a directory");
}

export async function isFile(file: PathLike, excepcion: boolean=false): Promise<boolean> {
    try {
        const stats = await stat(file);
        if (stats.isFile()) {
            return true;
        }
    } catch (e) {}

    if (!excepcion) {
        return false;
    }

    return Promise.reject("Not a file");
}

export function isFileSync(file: PathLike): boolean {
    return existsSync(file) && statSync(file).isFile();
}

export async function mkdir(dir: PathLike, recursive: boolean=false): Promise<void> {
    await mkdirOriginal(dir, {
        recursive: recursive
    });
}

export async function rename(antiguo: PathLike, nuevo: PathLike): Promise<boolean> {
    return renameOriginal(antiguo, nuevo)
        .then(()=>true)
        .catch(()=>false);
}

export async function rmdir(path: PathLike): Promise<void> {
    await rm(path, {
        recursive: true,
        force: true,
    });
    // return new Promise<void>((resolve: Function)=>{
    //     child_process.exec(`rm -R ${path}`, () => {
    //         resolve();
    //     });
    // });
}

export async function rmDirManual(path: PathLike): Promise<void> {
    if (await isDir(path)) {
        for (const actual of await readdir(path)) {
            await rmDirManual(`${path}/${actual}`);
        }
    }

    await unlink(path);
}

export async function overwrite(oldPath: PathLike, newPath: PathLike, sobreescribir: boolean): Promise<boolean> {
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

export async function safeWriteStream(inbound: Readable, local: PathLike, sobreescribir: boolean=false): Promise<boolean> {
    const rnd = `${local}.${random()}`;
    return await pipeline(inbound, fs.createWriteStream(rnd, {
        flags: "wx",
    }))
        .catch((err)=>{
            warning(`Error escribiendo temporal ${rnd}`, err);
            return Promise.reject(err);
        })
        .then(async ()=>overwrite(rnd, local, sobreescribir))
        .catch(async ()=>{
            if (await isFile(rnd)) {
                await unlink(rnd);
            }
            return false;
        });
}

export async function safeWriteStreamBuffer(inbound: Readable, local: PathLike, sobreescribir: boolean=false): Promise<boolean> {
    const buffer: Buffer[] = [];
    inbound.on("data", (data: Buffer)=>{
        buffer.push(data);
    });
    return new Promise<boolean>((resolve)=>{
        inbound.on("end", ()=>{
            safeWrite(local, Buffer.concat(buffer), sobreescribir).then(()=>{
                resolve(true);
            }).catch(()=>{
                resolve(false);
            });
        });
        inbound.on("error", ()=>{
            resolve(false);
        });
        // inbound.on("error", (err)=>{
        //     warning("Error en safeWriteStreamBuffer", err);
        //     resolve();
        // });
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

export async function findSubdirs(dir: string): Promise<string[]> {
    const salida: string[] = [];

    if (await isDir(dir)) {
        salida.push(dir);
        for (const item of await readdir(dir)) {
            if (![".", ".."].includes(item)) {
                salida.push(...await findSubdirs(`${dir}/${item}`));
            }
        }
    }

    return salida;
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
                if (name!=="files") {
                    salida.push(await md5Dir(name));
                }
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

export async function md5File(file: PathLike): Promise<string> {
    if (!await isFile(file)) {
        return "";
    }
    return md5(await readFileString(file));
}

export async function freeSpace(path: PathLike): Promise<number> {
    return new Promise((resolve, reject)=>{
        fs.statfs(path, (err, stats) => {
            if (err) {
                reject(err);
            } else {
                resolve(stats.bsize*stats.bavail);
            }
            // console.log('Total free space', formatMemoria(stats.bsize*stats.bfree));
            // console.log('Available for user', formatMemoria(stats.bsize*stats.bavail));
            // console.log(stats);
        })
    });
}
