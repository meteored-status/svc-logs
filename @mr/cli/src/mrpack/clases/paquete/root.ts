/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 98a6f1b79501999040a4facc7c4c73e6
 * Versión: 2026.7.14+1-josantoniojimnez
 * Anterior: 2026.7.3+2-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import JSZip from "jszip";

import {readDir, safeWrite, unlink} from "../../../utiles/fs";
import {incrementarVersion} from "../../utiles/version";
import {Comando} from "../comando";
import {type IPaqueteDirectory, PaqueteDirectory} from "./directory";
import {type IEntradaActualizacion, type IUpdateTracker} from "./file";

/**
 * Representación serializable del directorio raíz de un paquete,
 * incluyendo la versión publicada.
 *
 * @property version  - Versión actualmente publicada del paquete.
 * @property proyecto - URL del repositorio git desde el que se subió el paquete (sin credenciales).
 */
export interface IPaqueteDirectoryRoot extends IPaqueteDirectory {
    version: string;
    proyecto?: string;
}

/**
 * Contenido de un ZIP de paquete descomprimido: el status parseado y los ficheros en memoria.
 *
 * @property status - `PaqueteDirectoryRoot` reconstruido del `status.json` del ZIP, o `undefined` si el ZIP no existe.
 * @property files  - Mapa de rutas relativas a objetos `JSZipObject`.
 */
export interface PaqueteDirectoryRootFiles {
    status?: PaqueteDirectoryRoot;
    files: {[key: string]: JSZip.JSZipObject};
}

/**
 * Obtiene la URL del repositorio git remoto `origin` desde `basedir` y elimina
 * cualquier credencial embebida en la URL (p. ej. `https://TOKEN@github.com/…`
 * se convierte en `https://github.com/…`).
 *
 * @param basedir - Directorio de trabajo desde el que se invoca git.
 * @returns URL saneada, o cadena vacía si git no puede resolver el remoto.
 */
export async function getProyectoUrl(basedir: string): Promise<string> {
    const result = await Comando("git", ["remote", "get-url", "origin"], {cwd: basedir}).catch(() => undefined);
    if (result === undefined || result.status !== 0) {
        return "";
    }
    // Elimina credenciales embebidas: https://token@host → https://host
    return result.stdout.trim().replace(/^(https?:\/\/)[^@]+@/, "$1");
}

/**
 * Directorio raíz de un paquete mrpack. Extiende `PaqueteDirectory` añadiendo
 * el campo `version` y las operaciones de alto nivel: crear versión, actualizar,
 * resetear, empaquetar y subir a GCS.
 */
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
    public proyecto: string;

    protected constructor(public readonly frameworkDir: string, protected readonly basedir: string, data: IPaqueteDirectoryRoot) {
        super("", "", data);

        this.frameworkName = frameworkDir.replaceAll("/", "-");
        this.version = data.version;
        this.proyecto = data.proyecto ?? "";
    }

    public override toJSON(): IPaqueteDirectoryRoot {
        const padre = super.toJSON();
        const resultado: IPaqueteDirectoryRoot = {
            autor: padre.autor,
            fecha: padre.fecha,
            hash: padre.hash,
            hijos: padre.hijos,
            version: this.version,
        };
        if (this.proyecto.length > 0) {
            resultado.proyecto = this.proyecto;
        }
        return resultado;
    }

    public override clone(): PaqueteDirectoryRoot {
        return PaqueteDirectoryRoot.build(this.nombre, this.basedir, this.toJSON());
    }


    /**
     * Aplica la nueva versión publicada (`nuevo`) sobre el árbol local.
     * Hace un diff3 sobre la base `antiguo` y actualiza `this.version`, `this.autor` y `this.fecha`.
     *
     * @param nuevo    - Estado publicado que se quiere aplicar.
     * @param antiguo  - Estado publicado anterior (base del diff3).
     * @returns Resultado de la actualización: si hubo cambios, si hay conflictos y las entradas modificadas.
     */
    public async actualizarVersion(nuevo: PaqueteDirectoryRootFiles, antiguo: PaqueteDirectoryRootFiles): Promise<{actualizado: boolean; conflicto: boolean; entradas: IEntradaActualizacion[]}> {
        await this.crearVersion("mr-cli");

        if (nuevo.status===undefined) {
            return {actualizado: false, conflicto: false, entradas: []};
        }

        const tracker: IUpdateTracker = {hayConflictos: false, entradas: []};
        await this.checkCambios(this.basedir, this, antiguo, nuevo, false, tracker);

        const paquete = await nuevo.files["package.json"].async("text");
        await safeWrite(`${this.basedir}/package.json`, paquete, true);

        this.autor = nuevo.status.autor;
        this.fecha = nuevo.status.fecha;
        this.version = nuevo.status.version;

        return {actualizado: true, conflicto: tracker.hayConflictos, entradas: tracker.entradas};
    }

    /**
     * Actualiza `this.version` con el autor real sin re-escanear el árbol de ficheros.
     * Útil cuando ya se dispone de un status pre-calculado (p.e. desde `checkCambiosLocales`)
     * y solo hay que fijar el autor definitivo antes de subir el paquete.
     * También corrige los campos `autor` de todos los nodos que se escanearon con el autor
     * provisional `"check"`, sellándolos con el autor real antes de empaquetar.
     *
     * @param versionBase - Versión ANTES de que `crearVersion` la incrementara (la del ZIP).
     * @param autor       - Autor real con el que estampar la nueva versión.
     */
    public actualizarAutor(versionBase: string, autor: string): void {
        this.version = incrementarVersion(versionBase, autor);
        this.corregirAutoresHashCambio(autor);
    }

    /**
     * Re-escanea el árbol de ficheros en disco y, si hay cambios, incrementa la versión.
     *
     * @param autor - Autor que se estampa si la versión cambia.
     * @returns `true` si la versión fue incrementada.
     */
    public async crearVersion(autor: string): Promise<boolean> {
        const hash = this.hash;
        const nuevo = await super.update(this.basedir, autor, ["status.json"]);

        if (hash!==nuevo) {
            this.version = incrementarVersion(this.version, autor);
            return true;
        }

        return false;
    }

    /**
     * Ejecuta la inyección de bloques de autoría en todos los `.ts` modificados.
     * Se llama justo antes de empaquetar para dejar el bloque de autoría actualizado.
     * También fija `this.proyecto` para que quede registrado en el `status.json` del ZIP.
     *
     * @param autor - Nombre del autor a estampar.
     */
    public async prepararParaPush(autor: string): Promise<void> {
        const proyecto = await getProyectoUrl(this.basedir);
        this.proyecto = proyecto;
        await this.inyectarAutorias(this.basedir, autor, this.version, proyecto);
    }

    /**
     * Devuelve la lista de rutas de ficheros del paquete que han cambiado desde el último `crearVersion`.
     *
     * @returns Array de rutas relativas al paquete.
     */
    public getArchivosCambiados(): string[] {
        return this.listarCambios();
    }

    /**
     * Busca en el árbol la entrada correspondiente a la ruta relativa indicada
     * y devuelve el nombre del autor registrado en el `status.json`, o `undefined`
     * si el fichero no está en el árbol.
     * Funciona para todos los tipos de fichero, no solo `.ts`.
     *
     * @param relativePath - Ruta relativa al directorio raíz del paquete (p.ej. `src/index.ts`).
     * @returns Nombre del autor o `undefined` si el fichero no existe en el status.
     */
    public getAutorArchivo(relativePath: string): string | undefined {
        const partes = relativePath.split("/");
        let dir: PaqueteDirectory = this;
        for (let i = 0; i < partes.length - 1; i++) {
            const siguiente = dir.directorios[partes[i]];
            if (siguiente === undefined) { return undefined; }
            dir = siguiente;
        }
        const ultimo = partes[partes.length - 1];
        return dir.archivos[ultimo]?.autor;
    }

    /**
     * Descarta todos los cambios locales y restaura el árbol al estado de la versión publicada indicada.
     *
     * @param nuevo - Estado publicado al que se quiere volver.
     * @returns `true` siempre (operación completada).
     */
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

    /**
     * Genera el archivo ZIP del paquete con `status.json` y todos los ficheros del árbol.
     *
     * @returns Buffer con el contenido ZIP comprimido con DEFLATE nivel 9.
     */
    public async empaquetar(): Promise<Buffer> {
        const zip = new JSZip();
        zip.file("status.json", Buffer.from(JSON.stringify(this, null, 2)), {binary: true, compression: "DEFLATE", compressionOptions: {level: 9,}, createFolders: true})

        await this.pack(this.basedir, zip);

        return zip.generateAsync({type:"nodebuffer"});
    }

    /**
     * Sube el contenido del paquete al bucket GCS legado mediante `gsutil`.
     * Primero elimina la carpeta remota y luego la re-sube completa.
     *
     */
    public async subirLegacy(): Promise<void> {
        {
            const {status} = await Comando("gsutil", ["-o", "GSUtil:parallel_process_count=1", "-m", "rm", "-r", `gs://meteored-yarn-workspaces/${this.frameworkDir}`], {
                cwd: this.basedir,
            });
            if (status!==0) {
                return Promise.reject(new Error("Error borrando repositorio antiguo"));
            }
        }
        {
            const {status} = await Comando("gsutil", ["-o", "GSUtil:parallel_process_count=1", "-m", "cp", "-r", `${this.basedir}/*`, `gs://meteored-yarn-workspaces/${this.frameworkDir}/`], {
                cwd: this.basedir,
            });
            if (status!==0) {
                return Promise.reject(new Error("Error subiendo repositorio antiguo"));
            }
        }
    }
}
