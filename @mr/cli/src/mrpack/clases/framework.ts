import {Storage} from "@google-cloud/storage";
import {spawn} from "node:child_process";

import {Deferred} from "services-comun/modules/utiles/promise";
import {isDir, isFile, md5Dir, readDir, readFileString, safeWrite,} from "services-comun/modules/utiles/fs";

import {Colors} from "./colors";
import {Comando} from "./comando";
import {Paquete, PaqueteTipo} from "./paquete";
import {Yarn} from "./yarn";

export class Framework {
    /* STATIC */
    public static async add(basedir: string, frameworks: string[]): Promise<boolean> {
        return false;
    //     console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Añadiendo frameworks"));
    //     console.group();
    //     if (os.platform()=="win32") {
    //         console.log(Colors.colorize([Colors.FgRed], "No disponible en Windows"));
    //         console.groupEnd();
    //         return false;
    //     }
    //
    //     const promesas: Promise<boolean>[] = [];
    //     for (const dir of frameworks) {
    //         promesas.push(this.readConfig(`${basedir}/framework/${dir}/package.json`).then(config=>new this(basedir, dir, config, true).pull()));
    //     }
    //     const cambios = await Promise.all(promesas)
    //         .catch((err)=>{
    //             console.groupEnd();
    //             return Promise.reject(err);
    //         });
    //
    //     console.groupEnd();
    //
    //     if (!cambios.reduce((a, b)=>a || b, false)) {
    //         return false;
    //     }
    //
    //     await Yarn.install(basedir, {verbose: false});
    //
    //     return true;
    }

    public static async remove(basedir: string, frameworks: string[]): Promise<boolean> {
        return false;
    //     console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Eliminando frameworks"));
    //     console.group();
    //     if (os.platform()=="win32") {
    //         console.log(Colors.colorize([Colors.FgRed], "No disponible en Windows"));
    //         console.groupEnd();
    //         return false;
    //     }
    //
    //     await mkdir(`${basedir}/tmp`, true);
    //     const promesas: Promise<boolean>[] = [];
    //     for (const dir of frameworks.filter(framework=>framework!="services-comun")) {
    //         if (await isDir(`${basedir}/framework/${dir}`)) {
    //             console.log(Colors.colorize([Colors.FgMagenta], dir), `=> Eliminando`);
    //             promesas.push(unlink(`${basedir}/framework/${dir}`)
    //                 .then(()=> {
    //                     console.log(Colors.colorize([Colors.FgMagenta], dir), `=> Eliminando [${Colors.colorize([Colors.FgGreen, Colors.Bright], "OK   ")}]`);
    //                     return true;
    //                 }).catch((err)=>{
    //                     console.log(Colors.colorize([Colors.FgMagenta], dir), `=> Eliminando [${Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR")}]`);
    //                     return Promise.reject(err);
    //                 })
    //             );
    //         }
    //     }
    //     const cambios = await Promise.all(promesas)
    //         .catch((err)=>{
    //             console.groupEnd();
    //             return Promise.reject(err);
    //         });
    //
    //     console.groupEnd();
    //
    //     if (!cambios.reduce((a, b)=>a || b, false)) {
    //         return false;
    //     }
    //
    //     await Yarn.install(basedir, {verbose: false});
    //
    //     return true;
    }

    public static async list(tipo: string, bucket="meteored-yarn-packages"): Promise<void> {
        const storage = new Storage();
        let subdir: string;
        switch(tipo) {
            case PaqueteTipo.client:
                subdir = "@mr/client";
                break;
            case PaqueteTipo.core:
                subdir = "@mr/core";
                break;
            default:
                subdir = "@mr/legacy";
                break;
        }

        try {
            const [, , fws] = await storage
                .bucket(bucket)
                .getFiles({
                    delimiter: "/",
                    prefix: `${subdir}/`,
                });

            const {prefixes} = fws as { prefixes: string[] };
            for (const prefix of prefixes) {
                const framework = prefix.replace(`${subdir}/`, "").split("/")[0];
                console.log(" ", Colors.colorize([Colors.FgMagenta], framework));
            }
        } catch (err) {
            console.error("No se puede tener acceso al listado de frameworks");
        }
    }

    public static async getClienteHash(basedir: string): Promise<string> {
        return readFileString(`${basedir}/@mr/cli/bin/hash.md5`).catch(()=>"");
    }

    public static async getClienteMD5(basedir: string): Promise<string> {
        return md5Dir(`${basedir}/@mr/cli/bin/min`);
    }

    // si está desactualizado entonces devuelve el hash viejo, si está actualizado devuelve undefined
    public static async checkCliente(basedir: string): Promise<string|undefined> {
        if (await isFile(`${basedir}/@mr/cli/bin/hash.md5`)) {
            const [hash, md5] = await Promise.all([
                this.getClienteHash(basedir),
                this.getClienteMD5(basedir),
            ]);
            if (hash!=md5) {
                return hash;
            }
        }

        return undefined;
    }

    public static async recompilarCliente(basedir: string, hash: string): Promise<void> {
        await Yarn.install(basedir, {verbose: false, optimize: true});

        console.log(Colors.colorize([Colors.FgGreen, Colors.Bright], "Compilando nueva versión del cliente"));
        await Comando.spawn("yarn", ["run", "compile"], {cwd: `${basedir}/@mr/cli`});
        const md5 = await md5Dir(`${basedir}/@mr/cli/bin/min`);
        await safeWrite(`${basedir}/@mr/cli/bin/hash.md5`, md5, true);

        if (md5==hash) {
            return;
        }

        console.log(Colors.colorize([Colors.FgYellow, Colors.Bright], "Reiniciando..."));
        console.groupEnd();
        console.log("");
        const child = spawn("yarn", ["mrpack", ...process.argv.slice(2)], {
            stdio: 'inherit',
            // detached: true
        });
        // child.unref();
        const promesa = new Deferred<number>();
        child.on("exit", (code)=>{
            promesa.resolve(code??0);
        });
        await promesa.promise;
        process.exit();
    }

    public static async getAutor(): Promise<string> {
        const {status, stdout} = await Comando.spawn("git", ["config", "user.name"]);
        if (status!=0) {
            console.log(Colors.colorize([Colors.FgRed], "No se puede obtener el usuario de git"));
            console.groupEnd();
            return Promise.reject();
        }
        return stdout.trim();
    }

    public static async pull(basedir: string, forzar: boolean): Promise<boolean> {
        console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Comprobando cliente"));
        console.group();
        const paquete = await Paquete.build(`${basedir}/@mr/cli`);
        if (await paquete.pull(forzar)) {
            await this.recompilarCliente(basedir, await this.getClienteHash(basedir));
        }
        console.groupEnd();

        console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Comprobando frameworks"));
        console.group();

        const promesas: Promise<boolean>[] = [];
        if (await isDir(`${basedir}/@mr/core`)) {
            for (const dir of await readDir(`${basedir}/@mr/core`)) {
                const paquete = await Paquete.build(`${basedir}/@mr/core/${dir}`);
                promesas.push(paquete.pull(forzar));
            }
        }
        if (await isDir(`${basedir}/framework`)) {
            for (const dir of await readDir(`${basedir}/framework`)) {
                const paquete = await Paquete.build(`${basedir}/framework/${dir}`);
                promesas.push(paquete.pull(forzar));
            }
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

        const autor = await this.getAutor();

        const [cli, ...paquetes] = await Paquete.loadAll(basedir);

        const promesas: Promise<boolean>[] = [];
        promesas.push(cli.push(autor));
        for (const paquete of paquetes) {
            promesas.push(paquete.push(autor));
        }

        const exito = await Promise.all(promesas)
            .catch((err) => {
                console.groupEnd();
                return Promise.reject(err);
            });

        console.groupEnd();

        return exito.reduce((a, b)=>a || b, false);
    }

    public static async reset(basedir: string): Promise<void> {
        console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Reseteando frameworks"));
        console.group();

        // reseteamos el Cli
        const paquete = await Paquete.build(`${basedir}/@mr/cli`);
        const hash = await this.getClienteHash(basedir);
        await paquete.reset();
        await this.recompilarCliente(basedir, hash);

        const promesas: Promise<void>[] = [];
        // reseteamos los FW Core
        if (await isDir(`${basedir}/@mr/core`)) {
            for (const dir of await readDir(`${basedir}/@mr/core`)) {
                const paquete = await Paquete.build(`${basedir}/@mr/core/${dir}`);
                promesas.push(paquete.reset());
            }
        }
        // reseteamos los FW Legacy
        if (await isDir(`${basedir}/framework`)) {
            for (const dir of await readDir(`${basedir}/framework`)) {
                const paquete = await Paquete.build(`${basedir}/framework/${dir}`);
                promesas.push(paquete.reset());
            }
        }
        await Promise.all(promesas);

        console.groupEnd();
    }

    /* INSTANCE */
}
