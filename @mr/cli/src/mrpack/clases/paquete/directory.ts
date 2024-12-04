import JSZip from "jszip";
import {Colors} from "services-comun/modules/utiles/colors";

import {isDir, isFile, mkdir, readDir, readFileString, unlink} from "services-comun/modules/utiles/fs";
import {md5} from "services-comun/modules/utiles/hash";

import {PaqueteFile, type IPaqueteFile, type PaqueteFileFiles} from "./file";

export interface IPaqueteDirectory extends IPaqueteFile {
    hijos: Record<string, IPaqueteFile|IPaqueteDirectory>;
}

export interface PaqueteDirectoryFiles extends PaqueteFileFiles {
    status?: PaqueteDirectory;
}

export class PaqueteDirectory extends PaqueteFile {
    /* STATIC */
    public static override get DEFECTO(): IPaqueteDirectory {
        return {
            autor: "mr-cli",
            fecha: new Date(0).toISOString(),
            hash: "",
            hijos: {},
        };
    }

    public static override build(nombre: string, path: string, data: IPaqueteDirectory=this.DEFECTO): PaqueteDirectory {
        return new this(nombre, path, data);
    }

    /* INSTANCE */
    public archivos: Record<string, PaqueteFile>;
    public directorios: Record<string, PaqueteDirectory>;

    protected constructor(nombre: string, path: string, data: IPaqueteDirectory) {
        super(nombre, path, data);

        this.archivos = {};
        this.directorios = {};
        for (const [nombre, hijo] of Object.entries(data.hijos)) {
            if ("hijos" in hijo) {
                this.directorios[nombre] = PaqueteDirectory.build(nombre, this.filename, hijo);
            } else {
                this.archivos[nombre] = PaqueteFile.build(nombre, this.filename, hijo);
            }
        }
    }

    public override toJSON(): IPaqueteDirectory {
        const padre = super.toJSON();
        const hijos: Record<string, IPaqueteFile|IPaqueteDirectory> = {};
        for (const key of Object.keys(this.archivos)) {
            const hijo = this.archivos[key];
            hijos[hijo.nombre] = hijo.toJSON();
        }
        for (const key of Object.keys(this.directorios)) {
            const hijo = this.directorios[key];
            hijos[hijo.nombre] = hijo.toJSON();
        }

        // lo hacemos elemento a elemento por rendimiento {...} es más lento
        return {
            autor: padre.autor,
            fecha: padre.fecha,
            hash: padre.hash,
            hijos,
        };
    }

    public override clone(): PaqueteDirectory {
        return PaqueteDirectory.build(this.nombre, this.path, this.toJSON());
    }

    protected rehash(autor: string): void {
        const hashes: string[] = [];
        for (const key of Object.keys(this.archivos)) {
            hashes.push(this.archivos[key].hash);
        }
        for (const key of Object.keys(this.directorios)) {
            hashes.push(this.directorios[key].hash);
        }

        this.recalcularHash(hashes, autor);
    }

    public deleteFile(file: PaqueteFile): void {
        delete this.archivos[file.nombre];
    }

    public deleteDirectory(directory: PaqueteDirectory): void {
        delete this.directorios[directory.nombre];
    }

    public toFile(): PaqueteFile {
        return new PaqueteFile(this.nombre, this.path, {
            autor: this.autor,
            fecha: this.fecha.toISOString(),
            hash: md5(this.filename),
        });
    }

    public override async crearPath(basedir: string): Promise<void> {
        await mkdir(`${basedir}/${this.filename}`, true);
    }

    public async isDirectory(basedir: string): Promise<boolean> {
        return await isDir(`${basedir}/${this.filename}`);
    }

    private resort(): void {
        const archivos: Record<string, PaqueteFile> = {};
        for (const key of Object.keys(this.archivos).sort()) {
            archivos[key] = this.archivos[key];
        }
        this.archivos = archivos;

        const directorios: Record<string, PaqueteDirectory> = {};
        for (const key of Object.keys(this.directorios).sort()) {
            directorios[key] = this.directorios[key];
        }
        this.directorios = directorios;
    }

    private async checkTipos(basedir: string): Promise<boolean> {
        let cambio = false;
        for (const key of Object.keys(this.archivos)) {
            if (await this.archivos[key].isFile(basedir)) {
                continue;
            }

            const directorio = this.archivos[key].toDirectory();
            if (await directorio.isDirectory(basedir)) {
                this.directorios[key] = directorio;
            }
            delete this.archivos[key];
            cambio = true;
        }
        for (const key of Object.keys(this.directorios)) {
            if (await this.directorios[key].isDirectory(basedir)) {
                continue;
            }

            const archivo = this.directorios[key].toFile();
            if (await archivo.isFile(basedir)) {
                this.archivos[key] = archivo;
            }
            delete this.directorios[key];
            cambio = true;
        }

        return cambio;
    }

    private async addNuevos(dir: string, files: string[], ignore: string[]): Promise<boolean> {
        let cambio = false;
        for (const file of files) {
            if (ignore.includes(file) || file.includes("~") || file.endsWith(".bak")) {
                continue;
            }

            if (await isFile(`${dir}/${file}`)) {
                cambio = true;
                this.archivos[file] = PaqueteFile.build(file, this.filename);
            } else if (await isDir(`${dir}/${file}`)) {
                cambio = true;
                this.directorios[file] = PaqueteDirectory.build(file, this.filename);
            }
        }

        return cambio;
    }

    public override async update(basedir: string, autor: string, ignore: string[] = []): Promise<string> {
        const dir = `${basedir}/${this.filename}`;

        const files = await readDir(dir);
        ignore.push(".DS_Store", "node_modules");
        if (files.includes(".mr-ignore")) {
            ignore.push(...await readFileString(`${dir}/.mr-ignore`).then(data=>data.trim().split("\n")));
        }
        files.sort();

        for (const file of ignore) {
            delete this.archivos[file];
            delete this.directorios[file];
        }

        const cambioTipos = await this.checkTipos(basedir);
        const cambioNuevos = await this.addNuevos(dir, files, ignore);
        if (cambioTipos || cambioNuevos) {
            this.resort();
        }

        const hashes: string[] = [];
        for (const key of Object.keys(this.archivos)) {
            hashes.push(await this.archivos[key].update(basedir, autor));
        }
        for (const key of Object.keys(this.directorios)) {
            hashes.push(await this.directorios[key].update(basedir, autor));
        }

        this.recalcularHash(hashes, autor);

        return this.hash;
    }

    public override async pack(basedir: string, zip: JSZip): Promise<void> {
        for (const file of Object.keys(this.archivos)) {
            await this.archivos[file].pack(basedir, zip);
        }
        for (const dir of Object.keys(this.directorios)) {
            await this.directorios[dir].pack(basedir, zip);
        }
    }

    protected async checkCambiosEjecutar(basedir: string, antiguo: PaqueteDirectoryFiles, nuevo: PaqueteDirectoryFiles, bin: boolean): Promise<boolean> {
        let autor = this.autor;
        const archivos = Object.keys(this.archivos);
        const directorios = Object.keys(this.directorios);
        const promesas: Promise<boolean>[] = [];
        const bins: string[] = [];
        if (nuevo.status?.archivos[".mr-bin"]!=undefined) {
            let archivo: PaqueteFile;
            if (this.archivos[".mr-bin"]!=undefined) {
                archivo = this.archivos[".mr-bin"];
            } else {
                archivo = PaqueteFile.build(".mr-bin", this.filename);
                this.archivos[".mr-bin"] = archivo;
                promesas.push(Promise.resolve(true));
            }
            const bin = nuevo.status.archivos[".mr-bin"];
            const cambio = await archivo.checkCambios(basedir, this, {
                status: antiguo.status?.archivos[".mr-bin"],
                files: antiguo.files,
            }, {
                status: bin,
                files: nuevo.files,
            }, false).then((cambio)=>{
                if (cambio) {
                    autor = archivo.autor;
                }
                return cambio;
            });
            promesas.push(Promise.resolve(cambio));

            const contenido = await archivo.getContents(basedir);
            bins.push(...contenido.split("\n").map(line=>line.trim()).filter(line=>line.length>0));
        }

        // comprobamos archivos actuales
        for (const key of archivos) {
            if (key==".mr-bin") {
                continue;
            }
            const archivo = this.archivos[key];
            promesas.push(archivo.checkCambios(basedir, this, {
                status: antiguo.status?.archivos[key],
                files: antiguo.files,
            }, {
                status: nuevo.status?.archivos[key],
                files: nuevo.files,
            }, bin||bins.includes(key)).then((cambio)=>{
                if (cambio) {
                    autor = archivo.autor;
                }
                return cambio;
            }));
        }

        // comprobamos directorios actuales
        for (const key of directorios) {
            const directorio = this.directorios[key];
            promesas.push(directorio.checkCambios(basedir, this, {
                status: antiguo.status?.directorios[key],
                files: antiguo.files,
            }, {
                status: nuevo.status?.directorios[key],
                files: nuevo.files,
            }, bin||bins.includes(key)).then((cambio)=>{
                if (cambio) {
                    autor = directorio.autor;
                }
                return cambio;
            }));
        }

        // comprobamos nuevos
        if (nuevo.status!=undefined) {
            let cambio = false;
            // comprobamos archivos nuevos
            for (const key of Object.keys(nuevo.status.archivos)) {
                if (archivos.includes(key)) {
                    continue;
                }
                cambio = true;
                const archivo = PaqueteFile.build(key, this.filename);
                this.archivos[key] = archivo;
                promesas.push(archivo.checkCambios(basedir, this, {
                    status: undefined,
                    files: antiguo.files,
                }, {
                    status: nuevo.status.archivos[key],
                    files: nuevo.files,
                }, bin||bins.includes(key)).then(()=>true));
            }

            // comprobamos directorios nuevos
            for (const key of Object.keys(nuevo.status.directorios)) {
                if (directorios.includes(key)) {
                    continue;
                }
                cambio = true;
                const directorio = PaqueteDirectory.build(key, this.filename);
                this.directorios[key] = directorio;
                promesas.push(directorio.checkCambios(basedir, this, {
                    status: undefined,
                    files: antiguo.files,
                }, {
                    status: nuevo.status.directorios[key],
                    files: nuevo.files,
                }, bin||bins.includes(key)).then(()=>true));
            }
            if (cambio) {
                this.resort();
            }
        }

        const cambios = await Promise.all(promesas);
        const cambio = cambios.some(cambio=>cambio);
        if (cambio) {
            this.rehash(autor);
        }

        return cambio;
    }

    public override async checkCambios(basedir: string, padre: PaqueteDirectory, antiguo: PaqueteDirectoryFiles, nuevo: PaqueteDirectoryFiles, bin: boolean): Promise<boolean> {
        if (antiguo.status==undefined) {
            if (nuevo.status==undefined || this.hash==nuevo.status.hash) {
                // este directorio es nuevo (local) => mantenemos lo que tenemos
                // este directorio es nuevo (local y remoto) pero son iguales => mantenemos lo que tenemos
                // console.log("Ignorando cambios directorio 1", this.filename);
                return false;
            }

            // este directorio es nuevo (local y remoto) pero hay diferencias entre local y remoto => comprobamos contenidos
            return this.checkCambiosEjecutar(basedir, antiguo, nuevo, bin);
        }

        if (nuevo.status==undefined) {
            if(this.hash==antiguo.status.hash) {
                // este directorio es antiguo (local) se ha eliminado => lo eliminamos
                console.log(" - Eliminando      ", `${Colors.colorize([Colors.FgGreen, Colors.Bright], this.filename)}/`);
                await unlink(`${basedir}/${this.filename}`);
                padre.deleteDirectory(this);

                return true;
            }

            // este directorio es antiguo (local) pero ha cambiado => mantenemos lo que tenemos
            // console.log("Ignorando cambios directorio 2", this.filename);
            return false
        }

        if (this.hash==nuevo.status.hash) {
            // este directorio es antiguo (local) y remoto pero son iguales => mantenemos lo que tenemos
            // console.log("Ignorando cambios directorio 3", this.filename);
            return false;
        }

        // este directorio es antiguo (local) y remoto pero hay diferencias entre local y remoto => comprobamos contenidos
        return this.checkCambiosEjecutar(basedir, antiguo, nuevo, bin);
    }

    public override async resetCambios(basedir: string, nuevo: PaqueteDirectoryFiles): Promise<void> {
        const status = nuevo.status!;
        const promesas: Promise<void>[] = [];

        await this.crearPath(basedir);

        // restablecemos archivos
        for (const key of Object.keys(status.archivos)) {
            const archivo = PaqueteFile.build(key, this.filename);
            this.archivos[key] = archivo;
            promesas.push(archivo.resetCambios(basedir, {
                status: status.archivos[key],
                files: nuevo.files,
            }));
        }

        // restablecemos directorios
        for (const key of Object.keys(status.directorios)) {
            const directorio = PaqueteDirectory.build(key, this.filename);
            this.directorios[key] = directorio;
            promesas.push(directorio.resetCambios(basedir, {
                status: status.directorios[key],
                files: nuevo.files,
            }));
        }

        await Promise.all(promesas);

        this.autor = status.autor;
        this.hash = status.hash;
    }
}
