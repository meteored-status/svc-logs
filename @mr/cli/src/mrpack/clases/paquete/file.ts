import type JSZip from "jszip";
import path from "node:path";
import {Colors} from "services-comun/modules/utiles/colors";

import {Fecha} from "services-comun/modules/utiles/fecha";
import {isFile, md5File, mkdir, readFile, readFileString, safeWrite, unlink} from "services-comun/modules/utiles/fs";
import {md5} from "services-comun/modules/utiles/hash";

import {PaqueteDirectory} from "./directory";
import merge3 from "../../utiles/merge";

export interface IPaqueteFile {
    autor: string;
    fecha: string;
    hash: string;
}
export interface PaqueteFileFiles {
    status?: PaqueteFile;
    files: {[key: string]: JSZip.JSZipObject};
}

export class PaqueteFile {
    /* STATIC */
    public static get DEFECTO(): IPaqueteFile {
        return {
            autor: "mr-cli",
            fecha: new Date(0).toISOString(),
            hash: "",
        };
    }

    public static build(nombre: string, path: string, data: IPaqueteFile=this.DEFECTO): PaqueteFile {
        return new this(nombre, path, data);
    }

    /* INSTANCE */
    public autor: string;
    public fecha: Date;
    public hash: string;

    public readonly filename: string;

    protected constructor(public readonly nombre: string, protected readonly path: string, protected data: IPaqueteFile) {
        this.autor = data.autor;
        this.fecha = new Date(data.fecha);
        this.hash = data.hash;

        this.filename = this.path.length>0 ? `${this.path}/${this.nombre}` : this.nombre;
    }

    public toJSON(): IPaqueteFile {
        return {
            autor: this.autor,
            fecha: Fecha.generarFechaHoraMySQL(this.fecha),
            hash: this.hash,
        };
    }

    public clone(): PaqueteFile {
        return PaqueteFile.build(this.nombre, this.path, this.toJSON());
    }

    protected recalcularHash(hashes: string[], autor: string): boolean {
        const hash = md5([this.filename, ...hashes].join(""));
        if (hash==this.hash) {
            return false;
        }

        this.autor = autor;
        this.fecha = new Date();
        this.hash = hash;

        return true;
    }

    public toDirectory(): PaqueteDirectory {
        return PaqueteDirectory.build(this.nombre, this.path, {
            autor: this.autor,
            fecha: this.fecha.toISOString(),
            hash: md5(this.filename),
            hijos: {},
        });
    }

    public async crearPath(basedir: string): Promise<void> {
        await mkdir(path.dirname(`${basedir}/${this.filename}`), true);
    }

    public async isFile(basedir: string): Promise<boolean> {
        return await isFile(`${basedir}/${this.filename}`);
    }

    public async getContents(basedir: string): Promise<string> {
        return readFileString(`${basedir}/${this.filename}`);
    }

    public async update(basedir: string, autor: string): Promise<string> {
        this.recalcularHash([await md5File(`${basedir}/${this.filename}`)], autor);

        return this.hash;
    }

    public async pack(basedir: string, zip: JSZip): Promise<void> {
        zip.file(this.filename, readFile(`${basedir}/${this.filename}`), {binary: true, compression: "DEFLATE", compressionOptions: {level: 9,}, createFolders: true});
    }

    public async checkCambios(basedir: string, padre: PaqueteDirectory, antiguo: PaqueteFileFiles, nuevo: PaqueteFileFiles, bin: boolean): Promise<boolean> {
        if (antiguo.status==undefined) {
            if (nuevo.status==undefined && bin) {
                // archivo nuevo en directorio binario => eliminar
                console.log(" - Borrando        ", Colors.colorize([Colors.FgGreen, Colors.Bright], this.filename));
                await unlink(`${basedir}/${this.filename}`);
                padre.deleteFile(this);

                return true;
            }
            if (nuevo.status==undefined || this.hash==nuevo.status.hash) {
                // archivo nuevo => mantener
                // archivo nuevo y sin cambios respecto al nuevo => mantener
                // console.log("Ignorando cambios archivo 1", this.filename);
                return false;
            }

            console.log(" - Mezclando       ", this.filename);
            this.recalcularHash([await this.mezclar(basedir, nuevo.files[this.filename])], nuevo.status.autor);

            return true;
        }

        if (nuevo.status==undefined) {
            if (this.hash==antiguo.status.hash) {
                // archivo antiguo y sin cambios que se debe borrar => borrar
                console.log(" - Borrando        ", Colors.colorize([Colors.FgGreen, Colors.Bright], this.filename));
                await unlink(`${basedir}/${this.filename}`);
                padre.deleteFile(this);

                return true;
            }

            // archivo antiguo y con cambios que se debe borrar => ver que hacer => de momento lo mantenemos
            console.log(" - Manteniendo     ", Colors.colorize([Colors.FgGreen, Colors.Bright], this.filename));
            return false;
        }

        if (antiguo.status.hash==nuevo.status.hash) {
            // el antiguo no se ha cambiado respecto del nuevo => mantener
            // console.log("Ignorando cambios archivo 2", this.filename);
            return false;
        }

        if (antiguo.status.hash==this.hash) {
            // el antiguo no se ha cambiado respecto del actual => sobreescribir
            console.log(" - Sobreescribiendo", Colors.colorize([Colors.FgGreen, Colors.Bright], this.filename));

            await this.crearPath(basedir);
            await safeWrite(`${basedir}/${this.filename}`, await nuevo.files[this.filename].async("text"), true);
            this.autor = nuevo.status.autor;
            this.fecha = nuevo.status.fecha;
            this.hash = nuevo.status.hash;

            return true;
        }

        if (antiguo.status.hash!=this.hash && nuevo.status.hash!=this.hash) {
            // el antiguo, el actual y el nuevo son diferentes => mezclar
            console.log(" - Mezclando       ", Colors.colorize([Colors.FgGreen, Colors.Bright], this.filename));
            this.recalcularHash([await this.mezclar(basedir, nuevo.files[this.filename], !bin ? antiguo.files[this.filename] : undefined)], nuevo.status.autor);

            return true;
        }

        // console.log("Ignorando cambios archivo 3", this.filename);
        return false;
    }

    public async resetCambios(basedir: string, nuevo: PaqueteFileFiles): Promise<void> {
        const status = nuevo.status!;

        await safeWrite(`${basedir}/${this.filename}`, await nuevo.files[this.filename].async("text"), true);
        this.hash = status.hash;
        this.autor = status.autor;
    }

    private async mezclar(basedir: string, nuevo: JSZip.JSZipObject, antiguo?: JSZip.JSZipObject): Promise<string> {
        let mezcla: string;
        // el package.json no lo mezclamos, lo sobreescribimos de momento
        if (this.filename=="package.json" || antiguo==undefined || !await isFile(`${basedir}/${this.filename}`)) {
            mezcla = await nuevo.async("text");
        } else {
            const [a, b, c] = await Promise.all([
                antiguo.async("text"),
                this.getContents(basedir),
                nuevo.async("text"),
            ]);

            mezcla = merge3(a, b, c, this.filename);
        }

        await this.crearPath(basedir);
        await safeWrite(`${basedir}/${this.filename}`, mezcla, true);

        return md5(mezcla);
    }
}
