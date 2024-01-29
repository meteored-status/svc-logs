import {createHash} from "node:crypto";
import path from "node:path";

import {Colors} from "./colors";
import {Comando} from "./comando";
import {isDir, isFile, readDir, readFileString, readJSON, rmdir, safeWrite} from "../../../modules/utiles/fs";
import {mkdir, rename, unlink} from "../../../modules/utiles/fs";
import {Yarn} from "./yarn";

export class Framework {
    /* STATIC */
    public static async add(basedir: string, frameworks: string[]): Promise<boolean> {
        console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Añadiendo frameworks"));
        console.group();

        await mkdir(`${basedir}/tmp`, true);
        const promesas: Promise<boolean>[] = [];
        for (const dir of frameworks) {
            promesas.push(this.download(dir, `${basedir}/framework/${dir}`));
        }
        const cambios = await Promise.all(promesas)
            .catch((err)=>{
                console.groupEnd();
                return Promise.reject(err);
            });

        console.groupEnd();

        if (!cambios.reduce((a, b)=>a || b, false)) {
            return false;
        }

        await Yarn.install(basedir, {verbose: false});

        return true;
    }

    public static async remove(basedir: string, frameworks: string[]): Promise<boolean> {
        console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Eliminando frameworks"));
        console.group();

        await mkdir(`${basedir}/tmp`, true);
        const promesas: Promise<boolean>[] = [];
        for (const dir of frameworks.filter(framework=>framework!="services-comun")) {
            if (await isDir(`${basedir}/framework/${dir}`)) {
                console.log(Colors.colorize([Colors.FgMagenta], dir), `=> Eliminando`);
                promesas.push(unlink(`${basedir}/framework/${dir}`)
                    .then(()=> {
                        console.log(Colors.colorize([Colors.FgMagenta], dir), `=> Eliminando [${Colors.colorize([Colors.FgGreen, Colors.Bright], "OK   ")}]`);
                        return true;
                    }).catch((err)=>{
                        console.log(Colors.colorize([Colors.FgMagenta], dir), `=> Eliminando [${Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR")}]`);
                        return Promise.reject(err);
                    })
                );
            }
        }
        const cambios = await Promise.all(promesas)
            .catch((err)=>{
                console.groupEnd();
                return Promise.reject(err);
            });

        console.groupEnd();

        if (!cambios.reduce((a, b)=>a || b, false)) {
            return false;
        }

        await Yarn.install(basedir, {verbose: false});

        return true;
    }

    public static async update(basedir: string): Promise<boolean> {
        console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Comprobando frameworks"));
        console.group();

        await mkdir(`${basedir}/tmp`, true);
        const promesas: Promise<boolean>[] = [];
        for (const dir of await readDir(`${basedir}/framework`)) {
            promesas.push(this.download(dir, `${basedir}/framework/${dir}`));
        }
        const cambios = await Promise.all(promesas)
            .catch((err)=>{
                console.groupEnd();
                return Promise.reject(err);
            });

        console.groupEnd();

        return cambios.reduce((a, b)=>a || b, false);
    }

    public static async push(basedir: string): Promise<boolean> {
        console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Enviando frameworks"));
        console.group();

        const tmp = `${basedir}/tmp`;
        await mkdir(tmp, true);
        for (const item of await readDir(tmp)) {
            await unlink(`${tmp}/${item}`);
        }

        const promesas: Promise<boolean>[] = [];
        for (const dir of await readDir(`${basedir}/framework`)) {
            promesas.push(this.upload(dir, `${basedir}/framework/${dir}`, `${tmp}/${dir}`));
        }
        const exito = await Promise.all(promesas)
            .catch((err)=>{
                console.groupEnd();
                return Promise.reject(err);
            });

        console.groupEnd();

        return exito.reduce((a, b)=>a || b, false);
    }

    private static dateVersion(version: string): number {
        const [version_fecha, version_index] = version.split("+");

        const version_fecha_date = new Date(version_fecha);
        version_fecha_date.setUTCMinutes(parseInt(version_index));

        return version_fecha_date.getTime();
    }

    private static async parseDir(dir: string): Promise<string> {
        const salida: string[] = [];
        if (await isDir(dir)) {
            for (const actual of await readDir(dir)) {
                const name = dir + "/" + actual;
                if (await isDir(name)) {
                    salida.push(await this.parseDir(name));
                } else if (await isFile(name)) {
                    salida.push(createHash('md5').update(await readFileString(name)).digest("hex"));
                }
            }
            return salida.join("");
        }
        if (await isFile(dir)) {
            return createHash('md5').update(await readFileString(dir)).digest("hex");
        }
        return "";
    }

    private static async upload(nombre: string, dirname: string, tmp: string): Promise<boolean> {
        const paquete = await readJSON(`${dirname}/package.json`);
        const version = paquete.version??"2022.1.1+0";
        const versionNumber = this.dateVersion(version);
        const hash = paquete.hash??"";

        const {status, stdout} = await Comando.spawn("gsutil", ["cat", `gs://meteored-yarn-workspaces/${nombre}/package.json`]);
        if (status==0) {
            const actual = JSON.parse(stdout);
            const actualNumber = this.dateVersion(actual.version??"0000.00.00+0");
            if (actualNumber>versionNumber) {
                console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> Existe una nueva versión para descargar ${Colors.colorize([Colors.FgBlue], version)} => ${Colors.colorize([Colors.FgGreen], actual.version)} [${Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR")}]`);
                return false;
            }
        }

        delete paquete.version;
        delete paquete.hash;
        await safeWrite(`${dirname}/package.json`, JSON.stringify(paquete, null, 2), true);
        await mkdir(tmp, true);

        if (await isDir(`${dirname}/files`)) {
            await rename(`${dirname}/files`, `${tmp}/files`);
        }

        const md5 = createHash('md5').update(await this.parseDir(`${dirname}/`)).digest("hex");
        if (md5 !== hash) {
            const partes = /^(\d{4}\.\d{1,2}\.\d{1,2})\+(\d+)$/.exec(version);
            let fecha, index;
            if (partes == null) {
                fecha = "2022.1.1";
                index = "1";
            } else {
                fecha = partes[1];
                index = partes[2];
            }

            const date = new Date();
            const fechaActual = [
                date.getUTCFullYear(),
                date.getUTCMonth() + 1,
                date.getUTCDate(),
            ].join(".");

            let indice;
            if (fecha === fechaActual) {
                indice = parseInt(index) + 1
            } else {
                indice = 1;
            }

            await this.updatePackage(dirname, paquete, `${fechaActual}+${indice}`, md5);

            console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> Subiendo nueva versión ${Colors.colorize([Colors.FgBlue], version)} => ${Colors.colorize([Colors.FgGreen], paquete.version)}`);

            await Comando.spawn("gsutil", ["-o", '"GSUtil:parallel_process_count=1"', "-m", "rm", "-r", `gs://meteored-yarn-workspaces/${nombre}`]);
            await Comando.spawn("gsutil", ["-o", '"GSUtil:parallel_process_count=1"', "-m", "cp", "-r", dirname, "gs://meteored-yarn-workspaces/"]);

            console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> Subiendo nueva versión ${Colors.colorize([Colors.FgBlue], version)} => ${Colors.colorize([Colors.FgGreen], paquete.version)} [${Colors.colorize([Colors.FgGreen, Colors.Bright], "OK   ")}]`);

        } else {
            await this.updatePackage(dirname, paquete, version, hash);

            if (status > 0) {
                console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> Subiendo versión ${Colors.colorize([Colors.FgBlue], version)}`);

                await Comando.spawn("gsutil", ["-o", '"GSUtil:parallel_process_count=1"', "-m", "cp", "-r", dirname, "gs://meteored-yarn-workspaces/"]);

                console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> Subiendo versión ${Colors.colorize([Colors.FgBlue], version)} [${Colors.colorize([Colors.FgGreen, Colors.Bright], "OK   ")}]`);
            } else {
                console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> ${Colors.colorize([Colors.FgBlue], "Nada que subir")}`);
            }
        }

        if (await isDir(`${tmp}/files`)) {
            await rename(`${tmp}/files`, `${dirname}/files`);
        }
        await rmdir(tmp);

        return true;
    }

    private static async updatePackage(dirname: string, paquete: any, version: string, hash: string): Promise<void> {
        paquete.version = version;
        paquete.hash = hash;
        await safeWrite(`${dirname}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
    }

    private static async download(nombre: string, dirname: string): Promise<boolean> {
        const viejo = await isFile(`${dirname}/package.json`);
        const paquete = viejo ? await readJSON(`${dirname}/package.json`): {
            version: "0000.0.0+0",
        };
        const version = paquete.version??"0000.0.0+0";
        const versionNumber = this.dateVersion(version);

        let actual = paquete;
        {
            const {
                status,
                stdout,
                stderr,
            } = await Comando.spawn("gsutil", ["cat", `gs://meteored-yarn-workspaces/${nombre}/package.json`]);
            if (status == 0) {
                actual = JSON.parse(stdout);
                const actualNumber = this.dateVersion(actual.version);
                if (versionNumber >= actualNumber) {
                    console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> Actualizado ${Colors.colorize([Colors.FgBlue], version)}`);
                    return false;
                }

                if (viejo) {
                    console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> Nueva versión ${Colors.colorize([Colors.FgBlue], version)} => ${Colors.colorize([Colors.FgGreen], actual.version)}`);
                } else {
                    console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> Instalando ${Colors.colorize([Colors.FgGreen], actual.version)}`);
                }
            } else {
                if (!stderr.includes("No URLs matched")) {
                    console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> [${Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR")}]`);
                    console.log(Colors.colorize([Colors.FgMagenta], nombre), `=>`, stderr);
                    return Promise.reject();
                }

                console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> [${Colors.colorize([Colors.FgYellow, Colors.Bright], "NUEVO")}]`);
                return true;
            }
        }

        if (viejo) {
            const {status, stdout, stderr} = await Comando.spawn("git", ["diff", "--name-only", dirname]);
            if (status != 0) {
                console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> ${Colors.colorize([Colors.FgRed], "Error comprobando cambios locales")}`);
                console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> ${stderr}`);
                return Promise.reject();
            }

            const files = stdout.trim();
            if (files.length > 0) {
                return await this.downloadError(nombre, version, actual.version, files.split("\n"));
            }
        }

        const tmp = path.resolve(dirname, "../../tmp");
        await Promise.all([
            this.clearTMP(`${tmp}/${nombre}`),
            this.clearTMP(`${tmp}/${nombre}-old`),
        ]);
        const {status, stderr} = await Comando.spawn("gsutil", ["-o", '"GSUtil:parallel_process_count=1"', "-m", "cp", "-r", `gs://meteored-yarn-workspaces/${nombre}`, tmp]);
        if (status!=0) {
            return await this.downloadError(nombre, version, actual.version, stderr.split("\n"));
        }
        if (viejo) {
            if (await isDir(`${dirname}/files`)) {
                await rename(`${dirname}/files`, `${tmp}/${nombre}/files`);
            }
            if (!await rename(dirname, `${tmp}/${nombre}-old`)) {
                return await this.downloadError(nombre, version, actual.version, [`No se puede renombrar de ${dirname} a ${tmp}/${nombre}-old`]);
            }
        }
        if (!await rename(`${tmp}/${nombre}`, dirname)) {
            return await this.downloadError(nombre, version, actual.version, [`No se puede renombrar de ${tmp}/${nombre} a ${dirname}`]);
        }

        if (viejo) {
            console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> Nueva versión ${Colors.colorize([Colors.FgBlue], version)} => ${Colors.colorize([Colors.FgGreen], actual.version)} [${Colors.colorize([Colors.FgGreen, Colors.Bright], "OK   ")}]`);
        } else {
            console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> Instalando ${Colors.colorize([Colors.FgGreen], actual.version)} [${Colors.colorize([Colors.FgGreen, Colors.Bright], "OK   ")}]`);
        }

        return true;
    }

    private static async downloadError(nombre: string, anterior: string, nueva: string, detalle: string[]=[]): Promise<boolean> {
        console.log(Colors.colorize([Colors.FgMagenta], nombre), `=> Nueva versión ${Colors.colorize([Colors.FgBlue], anterior)} => ${Colors.colorize([Colors.FgGreen], nueva)} [${Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR")}]`);
        console.group();
        for (const linea of detalle) {
            console.log(Colors.colorize([Colors.FgYellow], linea));
        }
        console.groupEnd();

        return Promise.reject();
    }

    private static async clearTMP(name: string): Promise<void> {
        if (await isDir(name) || await isFile(name)) {
            await unlink(name);
        }
    }

    /* INSTANCE */
}
