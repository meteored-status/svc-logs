import {Storage} from "@google-cloud/storage";
import {confirm} from "@inquirer/prompts";

import {isDir, readDir, readJSON, safeWrite} from "services-comun/modules/utiles/fs";
import {buffer2stream, pipeline} from "services-comun/modules/utiles/stream";

import {Colors} from "../colors";
import {Comando} from "../comando";
import type {IPackageJson} from "../packagejson";
import {PaqueteDirectoryRoot, type PaqueteDirectoryRootFiles} from "./root";

export const enum PaqueteTipo {
    root   = "root",
    core   = "core",
    client = "client",
    legacy = "legacy",
}

interface IPaqueteCFG {
    bucket: string;
    subible: boolean;
    tipo: PaqueteTipo;
}

export interface IPackageFW extends IPackageJson {
    config: IPaqueteCFG;
}

enum ConsolaEstado {
    EMPTY,
    PENDING,
    OK,
    KO,
}

const STATUS = {
    [ConsolaEstado.EMPTY]:   `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([],                "       ")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
    [ConsolaEstado.PENDING]: `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([Colors.FgYellow], "PENDING")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
    [ConsolaEstado.OK]:      `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([Colors.FgGreen],  "OK     ")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
    [ConsolaEstado.KO]:      `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([Colors.FgRed],    "ERROR  ")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
};

interface IConsola {
    estado?: ConsolaEstado;
    actual?: boolean;
    nueva?: string;
    mensaje?: string;
}

export class Paquete {
    /* STATIC */
    private static SIMULAR: boolean = false;

    public static async build(basedir: string): Promise<Paquete> {
        const paquete = await readJSON<Partial<IPackageFW>>(`${basedir}/package.json`).catch(()=>Promise.reject(new Error(`No existe package.json en ${basedir}`)));

        return new this(basedir, paquete);
    }

    public static async loadAll(basedir: string, indexCli=true): Promise<[Paquete, ...Paquete[]]> {
        const paquetes: Promise<Paquete>[] = [
            this.build(`${basedir}/@mr/cli`),
        ];
        if (await isDir(`${basedir}/@mr/core`)) {
            for (const dir of await readDir(`${basedir}/@mr/core`)) {
                paquetes.push(this.build(`${basedir}/@mr/core/${dir}`));
            }
        }
        if (await isDir(`${basedir}/framework`)) {
            for (const dir of await readDir(`${basedir}/framework`)) {
                paquetes.push(this.build(`${basedir}/framework/${dir}`));
            }
        }

        const [cli, ...resto] = await Promise.all(paquetes);

        const len = resto.reduce((len, actual)=>Math.max(len, actual.nombre.length), cli.nombre.length);
        cli.ajustarConsolaPadding(len);
        cli.consolaAvanzada = true;
        if (indexCli) {
            cli.consolaLength = resto.length+1;
            console.log("");
        }
        const extra = indexCli ? 1 : 0;
        for (let i=0, length=resto.length; i<length; i++) {
            resto[i].ajustarConsolaPadding(len);
            resto[i].consolaIndex = i+extra;
            resto[i].consolaLength = length+1;
            resto[i].consolaAvanzada = true;
            console.log("");
        }

        return [cli, ...resto];
    }

    private static maquetarVersion(version: string): string {
        const [actual, build] = version.split("-")[0].split("+").slice(0, 2);
        const partes = actual.split(".");
        return `${partes[0].padStart(4, " ")}.${partes[1].padStart(2, " ")}.${partes[2].padStart(2, " ")}+${build}`.padEnd(13);
    }

    /* INSTANCE */
    public readonly nombre: string;
    protected version: string;
    protected readonly config: IPaqueteCFG;
    protected readonly storage: Storage;
    protected readonly repo: string;

    protected readonly consolaActual: string;
    protected readonly consolaOK: string;
    protected readonly consolaKO: string;
    protected consolaPadding: string;
    protected consolaIndex: number;
    protected consolaLength: number;
    protected consolaAvanzada: boolean;

    protected constructor(protected readonly basedir: string, protected paquete: Partial<IPackageFW>) {
        this.nombre = paquete.name!;
        this.version = paquete.version ?? "0.0.0.0+0";
        const config: Partial<IPaqueteCFG> = paquete.config ?? {};
        this.config = {
            subible: config.subible ?? true,
            bucket: config.bucket ?? "meteored-yarn-packages",
            tipo: config.tipo ?? PaqueteTipo.legacy,
        };
        this.storage = new Storage();

        this.consolaActual = Colors.colorize([Colors.FgBlue], Paquete.maquetarVersion(this.version));
        this.consolaOK = `[${Colors.colorize([Colors.FgGreen, Colors.Bright], "OK   ")}]`;
        this.consolaKO = `[${Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR")}]`;
        this.consolaPadding = "";
        this.consolaIndex = 0;
        this.consolaLength = 1;
        this.consolaAvanzada = false;

        const nombre = this.nombre.split("/").pop()!; // siempre hay al menos 1 elemento
        switch(this.config.tipo) {
            case PaqueteTipo.root:
                if (!["client", "core", "legacy"].includes(nombre)) { // protección contra-ataques, para evitar que alguien cree un fw con esos nombres
                    this.repo = `@mr/${nombre}`;
                } else {
                    this.repo = `@mr/legacy/${nombre}`;
                }
                break;

            case PaqueteTipo.core:
                this.repo = `@mr/core/${nombre}`;
                break;

            case PaqueteTipo.client:
                this.repo = `@mr/client/${nombre}`;
                break;

            default:
                this.repo = `@mr/legacy/${nombre}`;
                break;
        }
    }

    protected ajustarConsolaPadding(len: number): void {
        this.consolaPadding = " ".repeat(len - this.nombre.length);
    }

    protected consola({estado=ConsolaEstado.EMPTY, actual=false, nueva, mensaje}: IConsola): void {
        const salida: string[] = [];
        if (this.consolaAvanzada) {
            salida.push(Colors.up(this.consolaLength - this.consolaIndex));
        }
        salida.push(Colors.colorize([Colors.FgMagenta], `${this.nombre}${this.consolaPadding}`));
        salida.push(Colors.colorize([Colors.FgWhite, Colors.Bright], "["));
        if (actual) {
            salida.push(this.consolaActual);
        } else {
            salida.push(" ".repeat(13));
        }
        salida.push(Colors.colorize([Colors.FgWhite, Colors.Bright], "]"));
        salida.push(Colors.colorize([Colors.FgWhite, Colors.Bright], "=>"));
        salida.push(mensaje?.substring(0, 30).padEnd(30)??" ".repeat(30));
        salida.push(Colors.colorize([Colors.FgWhite, Colors.Bright], "["));
        if (nueva!=undefined) {
            salida.push(this.consolaNueva(nueva));
        } else {
            salida.push(" ".repeat(13));
        }
        salida.push(Colors.colorize([Colors.FgWhite, Colors.Bright], "]"));
        salida.push(STATUS[estado]);
        if (this.consolaAvanzada) {
            salida.push(Colors.down(this.consolaLength - this.consolaIndex - 1));
        }

        console.log(...salida);
    }

    protected consolaNueva(version: string): string {
        return Colors.colorize([Colors.FgGreen], Paquete.maquetarVersion(version));
    }

    private async reloadPaquete(): Promise<void> {
        this.paquete = await readJSON<Partial<IPackageFW>>(`${this.basedir}/package.json`);
    }

    private async savePaquete(): Promise<void> {
        await safeWrite(`${this.basedir}/package.json`, `${JSON.stringify(this.paquete, null, 2)}\n`, true);
    }

    // private async saveStatus(): Promise<void> {
    //     await safeWrite(`${this.basedir}/status.json`, `${JSON.stringify(this.status, null, 2)}\n`, true);
    // }

    public async pull(actualizar: boolean): Promise<boolean> {
        const latest = await this.getLatest();
        if (latest==undefined || !this.anticuado(latest)) {
            this.consola({
                estado: ConsolaEstado.OK,
                actual: true,
                mensaje: "Nada que actualizar",
            });
            return false;
        }

        const [antiguo, nuevo] = await Promise.all([
            this.getPaqueteAntiguo(),
            this.getPaqueteNuevo(latest),
        ]);

        if (nuevo==undefined) {
            this.consola({
                estado: ConsolaEstado.KO,
                actual: true,
                nueva: latest,
                mensaje: "Paquete no disponible",
            });
            return false;
        }
        this.consola({
            estado: ConsolaEstado.PENDING,
            actual: true,
            nueva: latest,
            mensaje: "Nueva versión disponible",
        });

        if (!actualizar) {
            actualizar = await confirm({
                message: "¿Desea actualizar? (5s)",
                default: true,
            }, {
                signal: AbortSignal.timeout(5000),
            }).catch(()=>true);
        }

        if (!actualizar) {
            return false;
        }

        let status: PaqueteDirectoryRoot;
        if (antiguo.status!=undefined) {
            status = antiguo.status.clone();
        } else {
            status = PaqueteDirectoryRoot.build(this.nombre, this.basedir);
            status.version = this.version;
        }

        if (await status.actualizarVersion(nuevo, antiguo)) {
            await this.reloadPaquete();
            this.version = status.version;
        }

        return true;
    }

    public async push(autor: string, legacy=false): Promise<boolean> {
        this.consola({
            estado: ConsolaEstado.PENDING,
            actual: this.config.subible,
            mensaje: "Comprobando actualización",
        });

        if (!this.config.subible) {
            this.consola({
                estado: ConsolaEstado.OK,
                mensaje: "Desactivado por configuración",
            });
            return false;
        }

        const latest = await this.getLatest();

        // hay una nueva versión que debemos descargar
        if (latest!=undefined &&  this.anticuado(latest)) {
            this.consola({
                estado: ConsolaEstado.KO,
                actual: true,
                nueva: latest,
                mensaje: "Existe una nueva versión",
            });
            return false;
        }

        let status: PaqueteDirectoryRoot;
        const actual = await this.getPaqueteAntiguo();

        if (actual.status!=undefined) {
            status = actual.status;
        } else {
            status = PaqueteDirectoryRoot.build(this.nombre, this.basedir);
            status.version = this.version;
        }

        this.paquete.version = "0.0.0+0";
        delete this.paquete.hash;
        await this.savePaquete();

        // la versión actual está actualizada
        if (!await status.crearVersion(autor) && latest!=undefined && !this.adelantado(latest)) {
            this.consola({
                estado: ConsolaEstado.OK,
                actual: true,
                mensaje: "No hay cambios que subir",
            });

            this.paquete.version = this.version;
            await this.savePaquete();

            return false;
        }

        // subimos la nueva versión
        this.consola({
            estado: ConsolaEstado.PENDING,
            actual: true,
            nueva: status.version,
            mensaje: "Subiendo la nueva versión"
        });

        if (!Paquete.SIMULAR) {
            this.version = status.version;
        }
        this.paquete.version = this.version;
        await this.savePaquete();

        if (!Paquete.SIMULAR) {
            await this.subirPaquete(status, legacy);
            await this.subirLatest();
        }

        this.consola({
            estado: ConsolaEstado.OK,
            actual: true,
            nueva: status.version,
            mensaje: "Se ha subido la nueva versión",
        });

        return true;
    }

    public async reset(): Promise<void> {
        const latest = await this.getLatest();
        if (latest==undefined) {
            this.consola({
                estado: ConsolaEstado.KO,
                actual: true,
                mensaje: "No hay versión para resetear",
            });
            return;
        }

        const nuevo = await this.getPaqueteNuevo(latest);

        if (nuevo.status==undefined) {
            this.consola({
                estado: ConsolaEstado.KO,
                actual: true,
                nueva: latest,
                mensaje: "No se encuentra en paquete",
            });
            return;
        }

        this.consola({
            estado: ConsolaEstado.PENDING,
            actual: false,
            nueva: latest,
            mensaje: "Reseteando",
        });
        await PaqueteDirectoryRoot.build(this.nombre, this.basedir).resetearVersion(nuevo);
        this.paquete.version = this.version = nuevo.status.version;

        this.consola({
            estado: ConsolaEstado.OK,
            actual: false,
            nueva: latest,
            mensaje: "Reseteo completo",
        });

        await this.savePaquete();
    }

    private anticuado(remota: string): boolean {
        // los formatos son YYYY.MM.DD+INDEX
        const [versionLocal, subversionLocal] = this.version.split("+");
        const [versionRemota, subversionRemota] = remota.split("+");
        const [aLocal, bLocal, cLocal] = versionLocal.split(".").map(valor=>parseInt(valor));
        const [aRemota, bRemota, cRemota] = versionRemota.split(".").map(valor=>parseInt(valor));

        return aLocal < aRemota ||
            aLocal==aRemota && bLocal < bRemota ||
            aLocal==aRemota && bLocal == bRemota && cLocal < cRemota ||
            aLocal==aRemota && bLocal == bRemota && cLocal == cRemota && parseInt(subversionLocal) < parseInt(subversionRemota);
    }

    private adelantado(remota: string): boolean {
        // los formatos son YYYY.MM.DD+INDEX
        const [versionLocal, subversionLocal] = this.version.split("+");
        const [versionRemota, subversionRemota] = remota.split("+");
        const [aLocal, bLocal, cLocal] = versionLocal.split(".").map(valor=>parseInt(valor));
        const [aRemota, bRemota, cRemota] = versionRemota.split(".").map(valor=>parseInt(valor));

        return aLocal > aRemota ||
            aLocal==aRemota && bLocal > bRemota ||
            aLocal==aRemota && bLocal == bRemota && cLocal > cRemota ||
            aLocal==aRemota && bLocal == bRemota && cLocal == cRemota && parseInt(subversionLocal) > parseInt(subversionRemota);
    }

    private async getLatest(login=false): Promise<string|undefined> {
        try {
            const file = this.storage
                .bucket(this.config.bucket)
                .file(`${this.repo}/stable.txt`);
            const [buffer] = await file.download();

            return buffer.toString("utf-8");
        } catch (err) {
            if (err instanceof Error) {
                if (!login && err.message.includes("storage.objects.get")) {
                    const {status} = await Comando.spawn("gcloud", ["auth", "application-default", "login"]);

                    if (status==0) {
                        return this.getLatest(true);
                    }
                } else if (err.message.includes("No such object")) {
                    return;
                }

                return Promise.reject(new Error(err.message));
            }

            return Promise.reject("Ha ocurrido un error comprobando la versión actual");
        }
    }

    private async subirLatest(): Promise<void> {
        const file = this.storage
            .bucket(this.config.bucket)
            .file(`${this.repo}/stable.txt`);
        const stream = file.createWriteStream({
            contentType: "text/plain",
        });
        await pipeline(buffer2stream(Buffer.from(this.version)), stream);
    }

    private async getZIP(paquete: string): Promise<PaqueteDirectoryRootFiles> {
        try {
            const file = this.storage
                .bucket(this.config.bucket)
                .file(`${this.repo}/${paquete}.zip`);
            const [buffer] = await file.download();

            if (buffer==undefined) {
                return {
                    files: {},
                };
            }

            return PaqueteDirectoryRoot.buildBuffer(this.nombre, this.basedir, buffer);
        } catch (err) {
            if (err instanceof Error) {
                if (err.message.includes("No such object")) {
                    return {
                        files: {},
                    };
                }

                return Promise.reject(new Error(err.message));
            }

            return Promise.reject("Ha ocurrido un error descargando el paquete antiguo");
        }
    }

    private async getPaqueteAntiguo(): Promise<PaqueteDirectoryRootFiles> {
        return this.getZIP(`stable-${this.version}`);
    }

    private async getPaqueteNuevo(version: string): Promise<PaqueteDirectoryRootFiles> {
        return this.getZIP(`stable-${version}`);
    }

    private async subirPaquete(status: PaqueteDirectoryRoot, legacy: boolean): Promise<void> {
        const data = await status.empaquetar();

        const file = this.storage
            .bucket(this.config.bucket)
            .file(`${this.repo}/stable-${this.version}.zip`);
        const stream = file.createWriteStream({
            contentType: "application/zip",
        });
        await pipeline(buffer2stream(data), stream);

        if (legacy) {
            const nombre = this.nombre.split("/").pop()!; // siempre hay al menos 1 elemento
            await pipeline(buffer2stream(data), this.storage
                .bucket(this.config.bucket)
                .file(`@mr/legacy/${nombre}/stable-${this.version}.zip`)
                .createWriteStream({
                    contentType: "application/zip",
                }));
            await pipeline(buffer2stream(Buffer.from(this.version)), this.storage
                .bucket(this.config.bucket)
                .file(`@mr/legacy/${nombre}/stable.txt`)
                .createWriteStream({
                    contentType: "text/plain",
                }));

            await status.subirLegacy();

            const file = this.storage
                .bucket("meteored-yarn-workspaces")
                .file(`${this.nombre}/status.json`);
            const stream = file.createWriteStream({
                contentType: "application/json",
            });
            await pipeline(buffer2stream(Buffer.from(JSON.stringify(status.toJSON(), null, 2))), stream);
        }
    }
}
