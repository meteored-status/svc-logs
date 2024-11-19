import JSZip from "jszip";

import {readDir, safeWrite, unlink} from "services-comun/modules/utiles/fs";

import {Comando} from "../comando";
import {type IPaqueteDirectory, PaqueteDirectory} from "./directory";

export interface IPaqueteDirectoryRoot extends IPaqueteDirectory {
    version: string;
}

export interface PaqueteDirectoryRootFiles {
    status?: PaqueteDirectoryRoot;
    files: {[key: string]: JSZip.JSZipObject};
}

export class PaqueteDirectoryRoot extends PaqueteDirectory {
    /* STATIC */
    public static override get DEFECTO(): IPaqueteDirectoryRoot {
        return {
            autor: "mr-cli",
            fecha: new Date(0).toISOString(),
            hash: "",
            hijos: {},
            version: "0.0.0.0+0",
        };
    }

    public static override build(nombre: string, basedir: string, data: IPaqueteDirectoryRoot=this.DEFECTO): PaqueteDirectoryRoot {
        return new this(nombre, basedir, data);
    }

    public static async buildBuffer(nombre: string, basedir: string, buffer: Buffer): Promise<PaqueteDirectoryRootFiles> {
        const files = await new JSZip().loadAsync(buffer)
            .then(zip=>zip.files);
        const status = await files["status.json"].async("nodebuffer");

        return {
            status: new this(nombre, basedir, JSON.parse(status.toString("utf-8"))),
            files,
        };
    }

    /* INSTANCE */
    public readonly frameworkName: string;
    public version: string;

    protected constructor(public readonly frameworkDir: string, protected readonly basedir: string, data: IPaqueteDirectoryRoot) {
        super("", "", data);

        this.frameworkName = frameworkDir.replaceAll("/", "-");
        this.version = data.version;
    }

    public override toJSON(): IPaqueteDirectoryRoot {
        const padre = super.toJSON();

        return {
            autor: padre.autor,
            fecha: padre.fecha,
            hash: padre.hash,
            hijos: padre.hijos,
            version: this.version,
        };
    }

    public override clone(): PaqueteDirectoryRoot {
        return PaqueteDirectoryRoot.build(this.nombre, this.basedir, this.toJSON());
    }

    private incrementarVersion(version: string, autor: string): string {
        // los formatos son YYYY.MM.DD+INDEX
        const partes = /^(\d{4}\.\d{1,2}\.\d{1,2})\+(\d+)(?:[+-](.*))?$/.exec(version);
        let fecha: string;
        let index: number;
        if (partes == null) {
            fecha = "2022.1.1";
            index = 1;
        } else {
            fecha = partes[1];
            index = parseInt(partes[2]);
        }

        const date = new Date();
        const fechaActual = [
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            date.getUTCDate(),
        ].join(".");

        if (fecha==fechaActual) {
            index++;
        } else {
            index = 1;
        }

        return `${fechaActual}+${index}-${autor.toLowerCase().replace(/\W/g, "")}`;
    }

    public async actualizarVersion(nuevo: PaqueteDirectoryRootFiles, antiguo: PaqueteDirectoryRootFiles): Promise<boolean> {
        await this.crearVersion("mr-cli");

        if (nuevo.status==undefined) {
            return false;
        }

        await this.checkCambios(this.basedir, this, antiguo, nuevo);

        const paquete = await nuevo.files["package.json"].async("text");
        await safeWrite(`${this.basedir}/package.json`, paquete, true);

        this.autor = nuevo.status.autor;
        this.fecha = nuevo.status.fecha;
        this.version = nuevo.status.version;

        return true;
    }

    public async crearVersion(autor: string): Promise<boolean> {
        const hash = this.hash;
        const nuevo = await super.update(this.basedir, autor, ["status.json"]);

        if (hash!=nuevo) {
            this.version = this.incrementarVersion(this.version, autor);
            return true;
        }

        return false;
    }

    public async resetearVersion(nuevo: PaqueteDirectoryRootFiles): Promise<boolean> {
        for (const file of await readDir(`${this.basedir}/${this.filename}`)) {
            await unlink(`${this.basedir}/${this.filename}/${file}`);
        }
        this.archivos = {};
        this.directorios = {};

        await this.resetCambios(this.basedir, nuevo);
        this.version = nuevo.status!.version;

        return true;
    }

    public async empaquetar(): Promise<Buffer> {
        const zip = new JSZip();
        zip.file("status.json", Buffer.from(JSON.stringify(this, null, 2)), {binary: true, compression: "DEFLATE", compressionOptions: {level: 9,}, createFolders: true})

        await this.pack(this.basedir, zip);

        return zip.generateAsync({type:"nodebuffer"});
    }

    public async subirLegacy(): Promise<void> {
        {
            const {status} = await Comando.spawn("gsutil", ["-o", "GSUtil:parallel_process_count=1", "-m", "rm", "-r", `gs://meteored-yarn-workspaces/${this.frameworkDir}`], {
                cwd: this.basedir,
            });
            if (status!=0) {
                return Promise.reject(new Error("Error borrando repositorio antiguo"));
            }
        }
        {
            const {status} = await Comando.spawn("gsutil", ["-o", "GSUtil:parallel_process_count=1", "-m", "cp", "-r", `${this.basedir}/*`, `gs://meteored-yarn-workspaces/${this.frameworkDir}/`], {
                cwd: this.basedir,
            });
            if (status!=0) {
                return Promise.reject(new Error("Error subiendo repositorio antiguo"));
            }
        }
    }
}
