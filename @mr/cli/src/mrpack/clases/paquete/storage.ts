/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 9043d9de53d5242c8bdf61fc7bfd698e
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import {Storage} from "@google-cloud/storage";

import {buffer2stream, pipeline} from "services-comun/modules/utiles/stream";

import {Comando} from "../comando";
import {type PaqueteDirectoryRootFiles, PaqueteDirectoryRoot} from "./root";

/**
 * Encapsula todas las operaciones de red con Google Cloud Storage para un paquete:
 * descarga de `stable.txt`, subida de ZIPs y consulta/escritura de la versión publicada.
 *
 * Se instancia una vez por `Paquete` y se accede mediante composición.
 */
export class PaqueteStorage {
    /* INSTANCE */
    private readonly storage: Storage;
    private _latestCache: Promise<string | undefined> | undefined;
    private _listaCache: Promise<string[]> | undefined;

    public constructor(private readonly bucket: string, private readonly repo: string, private readonly nombre: string, private readonly basedir: string) {
        this.storage = new Storage();
        this._latestCache = undefined;
        this._listaCache = undefined;
    }

    /** Invalida los cachés de versión remota para forzar una nueva consulta a GCS. */
    public invalidarCache(): void {
        this._latestCache = undefined;
        this._listaCache = undefined;
    }

    /** Devuelve (y cachea) la versión remota más reciente, o `undefined` si no existe.
     *
     * @returns Versión remota más reciente, o `undefined` si `stable.txt` no existe.
     */
    public getLatest(): Promise<string | undefined> {
        return this._latestCache ??= this.getListaCache().then(lista => lista[0]);
    }

    /** Devuelve (y cachea) el historial de versiones publicadas de `stable.txt`.
     *
     * @returns Lista de versiones publicadas (la más reciente en índice 0), o `[]` si no existe.
     */
    public getListaCache(): Promise<string[]> {
        return this._listaCache ??= this._fetchListaConLogin(false);
    }

    private async _fetchListaConLogin(login: boolean): Promise<string[]> {
        try {
            return await this._descargarLista();
        } catch (err) {
            if (err instanceof Error) {
                if (!login && err.message.includes("storage.objects.get")) {
                    const {status} = await Comando("gcloud", ["auth", "application-default", "login"]);
                    if (status == 0) {
                        return this._fetchListaConLogin(true);
                    }
                } else if (err.message.includes("No such object")) {
                    return [];
                }
                return Promise.reject(new Error(err.message));
            }
            return Promise.reject(new Error("Ha ocurrido un error comprobando la versión actual"));
        }
    }

    private async _descargarLista(): Promise<string[]> {
        const file = this.storage
            .bucket(this.bucket)
            .file(`${this.repo}/stable.txt`);
        const [buffer] = await file.download();
        return buffer.toString("utf-8")
            .split("\n")
            .map(l => l.trim())
            .filter(l => l.length > 0);
    }

    /**
     * Sube `version` como contenido de `stable.txt`.
     *
     * @param version - Versión a escribir en `stable.txt`.
     */
    public async subirLatest(version: string): Promise<void> {
        // TODO: reactivar historial multilinea cuando esté desplegado en todos los paquetes
        const file = this.storage
            .bucket(this.bucket)
            .file(`${this.repo}/stable.txt`);
        const stream = file.createWriteStream({contentType: "text/plain"});
        await pipeline(buffer2stream(Buffer.from(version)), stream);
    }

    /**
     * Descarga y parsea un ZIP de paquete desde GCS. Devuelve `{files:{}}` si no existe.
     *
     * @param nombreZip - Nombre del ZIP sin extensión (p.ej. `stable-2026.5.1+1`).
     * @returns Contenido del ZIP parseado, o `{files:{}}` si el objeto no existe en GCS.
     */
    public async getZIP(nombreZip: string): Promise<PaqueteDirectoryRootFiles> {
        const ruta = `${this.repo}/${nombreZip}.zip`;
        try {
            const file = this.storage.bucket(this.bucket).file(ruta);
            const [buffer] = await file.download();
            if (buffer === undefined) {
                return {files: {}};
            }
            return PaqueteDirectoryRoot.buildBuffer(this.nombre, this.basedir, buffer);
        } catch (err) {
            if (err instanceof Error) {
                if (err.message.includes("No such object")) {
                    return {files: {}};
                }
                return Promise.reject(new Error(err.message));
            }
            return Promise.reject(new Error("Ha ocurrido un error descargando el paquete antiguo"));
        }
    }

    /**
     * Empaqueta y sube el ZIP del status dado a `stable-{version}.zip`.
     *
     * @param version - Versión que se usará como nombre del archivo ZIP.
     * @param status  - Directorio raíz del paquete a empaquetar.
     */
    public async subirPaquete(version: string, status: PaqueteDirectoryRoot): Promise<void> {
        const data = await status.empaquetar();
        const file = this.storage
            .bucket(this.bucket)
            .file(`${this.repo}/stable-${version}.zip`);
        const stream = file.createWriteStream({contentType: "application/zip"});
        await pipeline(buffer2stream(data), stream);
    }
}

