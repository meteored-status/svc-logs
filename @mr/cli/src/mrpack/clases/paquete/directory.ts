/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 26 Jun 2026 10:04:43 GMT
 * Hash: b2b0d59f7b1c99ebd19812d1b92e94cb
 * Versión: 2026.6.26+1-josantoniojimnez
 * Anterior: 2026.6.25+5-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-web-www.git
 */

import JSZip from "jszip";

import {isDir, isFile, mkdir, readDir, readFileString, unlink} from "services-comun/modules/utiles/fs";
import {md5} from "services-comun/modules/utiles/hash";

import {PaqueteFile, type IPaqueteFile, type IUpdateTracker, type PaqueteFileFiles} from "./file";

/**
 * Representación serializable de un directorio dentro de un paquete mrpack.
 *
 * @property hijos - Mapa de nombre → fichero o subdirectorio.
 */
export interface IPaqueteDirectory extends IPaqueteFile {
    hijos: Record<string, IPaqueteFile|IPaqueteDirectory>;
}

/**
 * Par (status local, ficheros ZIP) para un `PaqueteDirectory`.
 *
 * @property status - Instancia local de `PaqueteDirectory`, o `undefined` si no existe.
 * @property files  - Mapa de rutas relativas a objetos `JSZipObject`.
 */
export interface PaqueteDirectoryFiles extends PaqueteFileFiles {
    status?: PaqueteDirectory;
}

/**
 * Representa un directorio dentro de un paquete mrpack.
 * Contiene listas de `PaqueteFile` y subdirectorios `PaqueteDirectory` anidados,
 * y orquesta las operaciones recursivas de hash, actualización y reset.
 */
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

    /**
     * Recalcula el hash de este directorio a partir de los hashes de sus hijos directos.
     *
     * @param autor - Autor que se registra si el hash cambia.
     */
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

    /**
     * Elimina un fichero hijo del registro interno de este directorio.
     *
     * @param file - Fichero a eliminar.
     */
    public deleteFile(file: PaqueteFile): void {
        delete this.archivos[file.nombre];
    }

    /**
     * Elimina un subdirectorio hijo del registro interno de este directorio.
     *
     * @param directory - Subdirectorio a eliminar.
     */
    public deleteDirectory(directory: PaqueteDirectory): void {
        delete this.directorios[directory.nombre];
    }

    /**
     * Convierte este directorio en una entrada `PaqueteFile` plana.
     * Útil cuando el tipo cambia en disco (era un directorio y ahora es un fichero).
     *
     * @returns Nueva instancia de `PaqueteFile` con el mismo nombre y ruta.
     */
    public toFile(): PaqueteFile {
        return new PaqueteFile(this.nombre, this.path, {
            autor: this.autor,
            fecha: this.fecha.toISOString(),
            hash: md5(this.filename),
        });
    }

    /**
     * Crea el directorio físico en disco (incluyendo intermedios).
     *
     * @param basedir - Raíz absoluta del monorepo.
     */
    public override async crearPath(basedir: string): Promise<void> {
        await mkdir(`${basedir}/${this.filename}`, true);
    }

    /**
     * Comprueba si este directorio existe físicamente en disco.
     *
     * @param basedir - Raíz absoluta del monorepo.
     * @returns `true` si existe como directorio.
     */
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
                if (this.archivos[file] === undefined) {
                    cambio = true;
                    this.archivos[file] = PaqueteFile.build(file, this.filename);
                }
            } else if (await isDir(`${dir}/${file}`)) {
                if (this.directorios[file] === undefined) {
                    cambio = true;
                    this.directorios[file] = PaqueteDirectory.build(file, this.filename);
                }
            }
        }

        return cambio;
    }

    /**
     * Recorre recursivamente el árbol de hijos actualizando los hashes de cada nodo.
     * Respeta `.mr-ignore` (excluir) y `.mr-nohash` (incluir pero no contribuir al hash padre).
     *
     * @param basedir - Raíz absoluta del monorepo.
     * @param autor   - Autor que se registra en los nodos que cambian.
     * @param ignore  - Lista adicional de nombres de fichero/directorio a ignorar.
     * @returns Hash actualizado de este directorio.
     */
    public override async update(basedir: string, autor: string, ignore: string[] = []): Promise<string> {
        const dir = `${basedir}/${this.filename}`;

        const files = await readDir(dir);
        ignore.push(".DS_Store", "node_modules");
        if (files.includes(".mr-ignore")) {
            ignore.push(...await readFileString(`${dir}/.mr-ignore`).then(data=>data.trim().split("\n")));
        }

        // Entradas listadas en .mr-nohash se incluyen en el paquete pero su hash
        // no contribuye al hash del directorio padre, por lo que los cambios en
        // esos hijos no disparan la detección de cambios del paquete.
        const nohash: string[] = [];
        if (files.includes(".mr-nohash")) {
            nohash.push(...await readFileString(`${dir}/.mr-nohash`).then(
                data => data.trim().split("\n").map(l => l.trim()).filter(l => l.length > 0),
            ));
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
            const hash = await this.archivos[key].update(basedir, autor);
            if (!nohash.includes(key)) {
                hashes.push(hash);
            }
        }
        for (const key of Object.keys(this.directorios)) {
            const hash = await this.directorios[key].update(basedir, autor);
            if (!nohash.includes(key)) {
                hashes.push(hash);
            }
        }

        this.recalcularHash(hashes, autor);

        return this.hash;
    }

    /**
     * Añade recursivamente todos los hijos al ZIP de empaquetado.
     *
     * @param basedir - Raíz absoluta del monorepo.
     * @param zip     - Instancia JSZip donde se añaden los ficheros.
     */
    public override async pack(basedir: string, zip: JSZip): Promise<void> {
        for (const file of Object.keys(this.archivos)) {
            await this.archivos[file].pack(basedir, zip);
        }
        for (const dir of Object.keys(this.directorios)) {
            await this.directorios[dir].pack(basedir, zip);
        }
    }

    /**
     * Corrige recursivamente el campo `autor` de todos los nodos (ficheros y subdirectorios)
     * cuyo `hashCambio === true`. Necesario cuando el árbol fue escaneado con un autor
     * provisional (p.ej. `"check"`) y hay que sellarlo con el autor real antes de empaquetarlo.
     *
     * @param autor - Nombre del autor real a estampar.
     */
    public corregirAutoresHashCambio(autor: string): void {
        if (this.hashCambio) {
            this.autor = autor;
        }
        for (const key of Object.keys(this.archivos)) {
            if (this.archivos[key].hashCambio) {
                this.archivos[key].autor = autor;
            }
        }
        for (const key of Object.keys(this.directorios)) {
            this.directorios[key].corregirAutoresHashCambio(autor);
        }
    }

    /**
     * Devuelve la lista de rutas relativas de TODOS los ficheros del subárbol,
     * independientemente de si han cambiado o no. Útil para detectar ficheros
     * que han sido eliminados del disco (y que `checkTipos` habría quitado del árbol).
     *
     * @returns Array de rutas relativas al paquete.
     */
    public listarRutas(): string[] {
        const rutas: string[] = [];
        for (const key of Object.keys(this.archivos)) {
            rutas.push(this.archivos[key].filename);
        }
        for (const key of Object.keys(this.directorios)) {
            rutas.push(...this.directorios[key].listarRutas());
        }
        return rutas;
    }

    /**
     * Devuelve la lista de rutas de ficheros cuyos hashes han cambiado desde el último `update`.
     *
     * @returns Array de rutas relativas al paquete.
     */
    public listarCambios(): string[] {
        const cambios: string[] = [];
        for (const key of Object.keys(this.archivos)) {
            const archivo = this.archivos[key];
            if (archivo.hashCambio) {
                cambios.push(archivo.filename);
            }
        }
        for (const key of Object.keys(this.directorios)) {
            cambios.push(...this.directorios[key].listarCambios());
        }
        return cambios;
    }

    /**
     * Inyecta recursivamente los bloques de autoría en todos los ficheros `.ts` modificados.
     *
     * @param basedir  - Raíz absoluta del monorepo.
     * @param autor    - Nombre del autor a estampar.
     * @param version  - Versión del paquete a registrar en cada bloque.
     * @param proyecto - URL del repositorio git del proyecto (sin credenciales).
     */
    public async inyectarAutorias(basedir: string, autor: string, version: string, proyecto: string): Promise<void> {
        let cambio = false;

        for (const key of Object.keys(this.archivos)) {
            const hashAnterior = this.archivos[key].hash;
            await this.archivos[key].inyectarAutoria(basedir, autor, version, proyecto);
            if (this.archivos[key].hash !== hashAnterior) {
                cambio = true;
            }
        }

        for (const key of Object.keys(this.directorios)) {
            const hashAnterior = this.directorios[key].hash;
            await this.directorios[key].inyectarAutorias(basedir, autor, version, proyecto);
            if (this.directorios[key].hash !== hashAnterior) {
                cambio = true;
            }
        }

        if (cambio) {
            this.rehash(autor);
        }
    }

    /**
     * Aplica recursivamente los cambios de la nueva versión sobre los hijos de este directorio.
     * Se procesa en paralelo; al final recalcula el hash si algún hijo cambió.
     *
     * @param basedir  - Raíz absoluta del monorepo.
     * @param antiguo  - Estado publicado anterior.
     * @param nuevo    - Estado publicado nuevo.
     * @param bin      - Si `true`, el directorio es tratado como binario.
     * @param tracker  - Tracker mutable para registrar artefactos afectados.
     * @returns `true` si algún hijo fue modificado.
     */
    protected async checkCambiosEjecutar(basedir: string, antiguo: PaqueteDirectoryFiles, nuevo: PaqueteDirectoryFiles, bin: boolean, tracker?: IUpdateTracker): Promise<boolean> {
        const archivos = Object.keys(this.archivos);
        const directorios = Object.keys(this.directorios);

        const {promesas, autorRef, bins} = await this._procesarExistentes(basedir, antiguo, nuevo, bin, tracker);
        const promesasNuevos = this._procesarNuevos(basedir, archivos, directorios, antiguo, nuevo, bin, bins, tracker);

        const cambios = await Promise.all([...promesas, ...promesasNuevos]);
        const cambio = cambios.some(c => c);
        if (cambio) {
            this.rehash(autorRef.value);
        }

        return cambio;
    }

    private async _procesarExistentes(basedir: string, antiguo: PaqueteDirectoryFiles, nuevo: PaqueteDirectoryFiles, bin: boolean, tracker?: IUpdateTracker): Promise<{promesas: Promise<boolean>[]; autorRef: {value: string}; bins: string[]}> {
        const autorRef = {value: this.autor};
        const archivos = Object.keys(this.archivos);
        const directorios = Object.keys(this.directorios);
        const promesas: Promise<boolean>[] = [];
        const bins: string[] = [];

        if (nuevo.status?.archivos[".mr-bin"] !== undefined) {
            let archivo: PaqueteFile;
            if (this.archivos[".mr-bin"] !== undefined) {
                archivo = this.archivos[".mr-bin"];
            } else {
                archivo = PaqueteFile.build(".mr-bin", this.filename);
                this.archivos[".mr-bin"] = archivo;
                promesas.push(Promise.resolve(true));
            }
            const mrBin = nuevo.status.archivos[".mr-bin"];
            const cambio = await archivo.checkCambios(basedir, this, {
                status: antiguo.status?.archivos[".mr-bin"],
                files: antiguo.files,
            }, {
                status: mrBin,
                files: nuevo.files,
            }, false, tracker).then((c) => {
                if (c) { autorRef.value = archivo.autor; }
                return c;
            });
            promesas.push(Promise.resolve(cambio));

            const contenido = await archivo.getContents(basedir);
            bins.push(...contenido.split("\n").map(line => line.trim()).filter(line => line.length > 0));
        }

        for (const key of archivos) {
            if (key === ".mr-bin") {
                continue;
            }
            const archivo = this.archivos[key];
            promesas.push(archivo.checkCambios(basedir, this, {
                status: antiguo.status?.archivos[key],
                files: antiguo.files,
            }, {
                status: nuevo.status?.archivos[key],
                files: nuevo.files,
            }, bin || bins.includes(key), tracker).then((c) => {
                if (c) { autorRef.value = archivo.autor; }
                return c;
            }));
        }

        for (const key of directorios) {
            const directorio = this.directorios[key];
            promesas.push(directorio.checkCambios(basedir, this, {
                status: antiguo.status?.directorios[key],
                files: antiguo.files,
            }, {
                status: nuevo.status?.directorios[key],
                files: nuevo.files,
            }, bin || bins.includes(key), tracker).then((c) => {
                if (c) { autorRef.value = directorio.autor; }
                return c;
            }));
        }

        return {promesas, autorRef, bins};
    }

    private _procesarNuevos(basedir: string, archivosExist: string[], directoriosExist: string[], antiguo: PaqueteDirectoryFiles, nuevo: PaqueteDirectoryFiles, bin: boolean, bins: string[], tracker?: IUpdateTracker): Promise<boolean>[] {
        if (nuevo.status === undefined) {
            return [];
        }

        const promesas: Promise<boolean>[] = [];
        let hayNuevos = false;

        for (const key of Object.keys(nuevo.status.archivos)) {
            if (archivosExist.includes(key)) {
                continue;
            }
            hayNuevos = true;
            const archivo = PaqueteFile.build(key, this.filename);
            this.archivos[key] = archivo;
            promesas.push(archivo.checkCambios(basedir, this, {
                status: undefined,
                files: antiguo.files,
            }, {
                status: nuevo.status.archivos[key],
                files: nuevo.files,
            }, bin || bins.includes(key), tracker).then(() => true));
        }

        for (const key of Object.keys(nuevo.status.directorios)) {
            if (directoriosExist.includes(key)) {
                continue;
            }
            hayNuevos = true;
            const directorio = PaqueteDirectory.build(key, this.filename);
            this.directorios[key] = directorio;
            promesas.push(directorio.checkCambios(basedir, this, {
                status: undefined,
                files: antiguo.files,
            }, {
                status: nuevo.status.directorios[key],
                files: nuevo.files,
            }, bin || bins.includes(key), tracker).then(() => true));
        }

        if (hayNuevos) {
            this.resort();
        }

        return promesas;
    }

    /**
     * Aplica los cambios de la nueva versión sobre este directorio (rama pública).
     * Gestiona la creación, actualización y eliminación del propio directorio.
     *
     * @param basedir  - Raíz absoluta del monorepo.
     * @param padre    - Directorio padre (para eliminar la referencia si se borra éste).
     * @param antiguo  - Estado publicado anterior.
     * @param nuevo    - Estado publicado nuevo.
     * @param bin      - Si `true`, directorio tratado como binario.
     * @param tracker  - Tracker mutable para registrar artefactos afectados.
     * @returns `true` si el directorio fue modificado.
     */
    public override async checkCambios(basedir: string, padre: PaqueteDirectory, antiguo: PaqueteDirectoryFiles, nuevo: PaqueteDirectoryFiles, bin: boolean, tracker?: IUpdateTracker): Promise<boolean> {
        if (antiguo.status===undefined) {
            if (nuevo.status===undefined || this.hash===nuevo.status.hash) {
                return false;
            }
            return this.checkCambiosEjecutar(basedir, antiguo, nuevo, bin, tracker);
        }

        if (nuevo.status===undefined) {
            if(this.hash===antiguo.status.hash) {
                await unlink(`${basedir}/${this.filename}`);
                padre.deleteDirectory(this);
                tracker?.entradas.push({archivo: `${this.filename}/`, estado: "ok"});
                return true;
            }
            return false;
        }

        if (this.hash===nuevo.status.hash) {
            return false;
        }

        return this.checkCambiosEjecutar(basedir, antiguo, nuevo, bin, tracker);
    }

    /**
     * Restaura recursivamente todos los hijos de este directorio al estado de la versión indicada.
     *
     * @param basedir - Raíz absoluta del monorepo.
     * @param nuevo   - Estado publicado cuyo contenido se restaura.
     */
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
