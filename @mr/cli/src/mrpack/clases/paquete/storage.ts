/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 01d62296d8f7e1b8e4555bb45929761a
 * Versión: 2026.7.14+1-josantoniojimnez
 * Anterior: 2026.6.25+5-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
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
    /* STATIC */

    /**
     * Promesa compartida entre todas las instancias para evitar abrir múltiples
     * procesos de `gcloud auth application-default login` en paralelo.
     * Se limpia al finalizar (éxito o error) para que una sesión futura pueda
     * re-autenticarse si fuera necesario.
     */
    private static _loginPromise: Promise<boolean> | undefined;

    /**
     * Devuelve `true` si el error corresponde a un fallo de autenticación o autorización
     * de GCS que puede resolverse volviendo a ejecutar `gcloud auth application-default login`.
     *
     * Patrones conocidos:
     * - `"storage.objects.get"` — IAM denegado (credenciales válidas, sin permisos suficientes).
     * - `"invalid_grant"`       — token de refresco expirado o revocado (HTTP 400).
     * - `"UNAUTHENTICATED"`     — error gRPC de autenticación.
     * - `"default credentials"` — ADC no configuradas en el sistema.
     * - `"PERMISSION_DENIED"`   — permiso denegado (gRPC / HTTP 403).
     *
     * @param err - Error lanzado por la librería de GCS.
     */
    private static esErrorDeAuth(err: Error): boolean {
        const m = err.message;
        return (
            m.includes("storage.objects.get") ||
            m.includes("invalid_grant") ||
            m.includes("UNAUTHENTICATED") ||
            m.includes("default credentials") ||
            m.includes("PERMISSION_DENIED")
        );
    }

    /**
     * Lanza `gcloud auth application-default login` una única vez aunque varias
     * operaciones GCS fallen simultáneamente por falta de credenciales.
     *
     * @returns `true` si el login terminó con éxito.
     */
    private static login(): Promise<boolean> {
        PaqueteStorage._loginPromise ??= Comando("gcloud", ["auth", "application-default", "login"])
            .then(({status}) => status === 0)
            .finally(() => {
                PaqueteStorage._loginPromise = undefined;
            });
        return PaqueteStorage._loginPromise;
    }

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
        return this._listaCache ??= this._fetchListaConLogin();
    }

    /**
     * Ejecuta una operación de GCS gestionando el reintento tras `gcloud auth application-default
     * login` (si el fallo es de autenticación) y el caso "objeto no encontrado".
     *
     * @param operacion    - Operación de GCS a ejecutar (y reintentar tras login si aplica).
     * @param onNotFound   - Valor a devolver si GCS responde "No such object".
     * @param mensajeError - Mensaje a usar si el error no es una instancia de `Error`.
     * @param login        - `true` si ya se ha reintentado tras un login (evita bucles).
     */
    private async ejecutarConLoginRetry<T>(operacion: () => Promise<T>, onNotFound: T, mensajeError: string, login: boolean = false): Promise<T> {
        try {
            return await operacion();
        } catch (err) {
            if (err instanceof Error) {
                if (!login && PaqueteStorage.esErrorDeAuth(err)) {
                    if (await PaqueteStorage.login()) {
                        return this.ejecutarConLoginRetry(operacion, onNotFound, mensajeError, true);
                    }
                } else if (err.message.includes("No such object")) {
                    return onNotFound;
                }
                throw new Error(err.message);
            }
            throw new Error(mensajeError);
        }
    }

    private async _fetchListaConLogin(): Promise<string[]> {
        return this.ejecutarConLoginRetry(() => this._descargarLista(), [], "Ha ocurrido un error comprobando la versión actual");
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
     * Si la descarga falla por credenciales insuficientes, lanza `gcloud auth
     * application-default login` (compartido con otras operaciones paralelas) y reintenta.
     *
     * @param nombreZip - Nombre del ZIP sin extensión (p.ej. `stable-2026.5.1+1`).
     * @returns Contenido del ZIP parseado, o `{files:{}}` si el objeto no existe en GCS.
     */
    public async getZIP(nombreZip: string): Promise<PaqueteDirectoryRootFiles> {
        return this.ejecutarConLoginRetry(() => this._descargarZIP(nombreZip), {files: {}}, "Ha ocurrido un error descargando el paquete antiguo");
    }

    private async _descargarZIP(nombreZip: string): Promise<PaqueteDirectoryRootFiles> {
        const ruta = `${this.repo}/${nombreZip}.zip`;
        const file = this.storage.bucket(this.bucket).file(ruta);
        const [buffer] = await file.download();
        if (buffer === undefined) {
            return {files: {}};
        }
        return PaqueteDirectoryRoot.buildBuffer(this.nombre, this.basedir, buffer);
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
