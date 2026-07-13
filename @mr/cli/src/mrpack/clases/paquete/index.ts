/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 03 Jul 2026 07:46:10 GMT
 * Hash: eb347f7504f5bf5d94a5379eb61330c4
 * Versión: 2026.7.3+2-josantoniojimnez
 * Anterior: 2026.7.2+2-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {confirm} from "@inquirer/prompts";

import {isDir, isFile, readDir, readFileString, readJSON, safeWrite} from "services-comun/modules/utiles/fs";

import {compararVersiones, maquetarVersion} from "../../utiles/version";
import {Colors} from "../colors";
import type {IPackageJson} from "../packagejson";
import {getProyectoUrl, PaqueteDirectoryRoot, type PaqueteDirectoryRootFiles} from "./root";
import {PaqueteStorage} from "./storage";
import {type IEntradaActualizacion, stripAutoria} from "./file";
import {type IArchivoConDiff, type IPushLogData, subirLogHtmlPush} from "./push-log";

/**
 * Elimina el bloque de autoría de un fichero `.ts` y devuelve también cuántas
 * líneas se eliminaron, para que el visor de diff pueda mostrar números de línea correctos.
 */
function stripAutoriaConOffset(texto: string): {texto: string; offset: number} {
    const stripped = stripAutoria(texto);
    if (stripped.length === texto.length) {
        return {texto: stripped, offset: 0};
    }
    const quitado = texto.slice(0, texto.length - stripped.length);
    return {texto: stripped, offset: (quitado.match(/\n/g) ?? []).length};
}

/**
 * Categoría de un paquete dentro del monorepo.
 *
 * - `root`   — paquete raíz (`@mr/cli`).
 * - `core`   — paquete de core (`@mr/core-*`).
 * - `user`   — paquete de usuario (`@mr/user-*`).
 * - `legacy` — paquete legacy en `framework/`.
 */
export const enum PaqueteTipo {
    root   = "root",
    core   = "core",
    user   = "user",
    legacy = "legacy",
}

interface IPaqueteCFG {
    bucket: string;
    subible: boolean;
    tipo: PaqueteTipo;
}

/**
 * Estado de un fichero en el listado de cambios del gestor de frameworks.
 *
 * - `Cambiado`  — el fichero existe en ambos lados pero con contenido diferente.
 * - `Nuevo`     — el fichero no existía antes (creado localmente o traído por el remoto).
 * - `Eliminado` — el fichero ha sido borrado.
 */
export const enum EstadoArchivo {
    Cambiado  = "cambiado",
    Nuevo     = "nuevo",
    Eliminado = "eliminado",
}

/**
 * Origen del cambio de un fichero en el listado combinado.
 *
 * - `Local`  — solo hay cambio en el lado local.
 * - `Remoto` — solo hay cambio en el lado remoto.
 * - `Ambos`  — hay cambio en los dos lados simultáneamente.
 */
export const enum OrigenArchivo {
    Local  = "local",
    Remoto = "remoto",
    Ambos  = "ambos",
}

/**
 * Fichero con estado de cambio para la vista de diff del gestor de frameworks.
 *
 * @property archivo   - Ruta relativa al directorio raíz del paquete.
 * @property estado    - Estado del fichero (`EstadoArchivo`).
 * @property origen    - Origen del cambio (`OrigenArchivo`).
 * @property conflicto - `true` cuando `origen === Ambos` y los estados son contradictorios (uno crea y el otro borra el mismo fichero).
 */
export interface IArchivoCambiado {
    archivo: string;
    estado: EstadoArchivo;
    origen: OrigenArchivo;
    conflicto?: boolean;
}

/**
 * `package.json` de un paquete gestionado por mrpack,
 * con el campo `config` obligatorio que describe el tipo y bucket del paquete.
 */
export interface IPackageFW extends IPackageJson {
    config: IPaqueteCFG;
}

enum ConsolaEstado {
    EMPTY,
    PENDING,
    OK,
    KO,
    CONFLICTO,
}

const STATUS = {
    [ConsolaEstado.EMPTY]:     `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([],                              "         ")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
    [ConsolaEstado.PENDING]:   `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([Colors.FgYellow],                "PENDING  ")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
    [ConsolaEstado.OK]:        `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([Colors.FgGreen],                 "OK       ")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
    [ConsolaEstado.KO]:        `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([Colors.FgRed],                   "ERROR    ")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
    [ConsolaEstado.CONFLICTO]: `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([Colors.FgMagenta, Colors.Bright], "CONFLICTO")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
};

interface IConsola {
    estado?: ConsolaEstado;
    actual?: boolean;
    nueva?: string;
    mensaje?: string;
}

/**
 * Snapshot del estado de cambios pre-calculado por `checkCambiosLocales`.
 * Se reutiliza en `push` para evitar re-escanear el árbol de ficheros y re-descargar el ZIP.
 *
 * @property status      - Clone del status local con los hashes actualizados.
 * @property hayCambios  - Resultado de `calcularHashCambiado`.
 * @property versionBase - Versión del ZIP descargado (antes del incremento de autor).
 * @property antiguo     - Contenido del ZIP de la versión anterior, para calcular diffs sin re-descargar.
 */
interface ISnapshotPrevio {
    status: PaqueteDirectoryRoot;
    hayCambios: boolean;
    versionBase: string;
    antiguo: PaqueteDirectoryRootFiles;
}

/**
 * Representa un paquete mrpack del monorepo con sus operaciones de ciclo de vida:
 * descarga (`pull`), publicación (`push`), reseteo y verificación de cambios.
 * Gestiona la comparación de versiones con GCS y la consola de progreso interactiva.
 */
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

        const [coreDirs, userDirs, fwDirs] = await Promise.all([
            isDir(`${basedir}/@mr/core`).then(ok => ok ? readDir(`${basedir}/@mr/core`) : []),
            isDir(`${basedir}/@mr/user`).then(ok => ok ? readDir(`${basedir}/@mr/user`) : []),
            isDir(`${basedir}/framework`).then(ok => ok ? readDir(`${basedir}/framework`) : []),
        ]);
        for (const dir of coreDirs) { paquetes.push(this.build(`${basedir}/@mr/core/${dir}`)); }
        for (const dir of userDirs) { paquetes.push(this.build(`${basedir}/@mr/user/${dir}`)); }
        for (const dir of fwDirs)   { paquetes.push(this.build(`${basedir}/framework/${dir}`)); }

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

    /**
     * Formatea una cadena de versión con el mismo relleno que usa la consola de progreso.
     * Útil para mostrar versiones fuera de los métodos internos de `Paquete`.
     *
     * @param version - Versión en formato `YYYY.MM.DD+INDEX`.
     * @returns Cadena de 13 caracteres rellena con espacios.
     */
    public static formatVersion(version: string): string {
        return maquetarVersion(version);
    }

    /**
     * Construye una instancia virtual de `Paquete` sin `package.json` local.
     * Útil para consultar la versión remota de paquetes no instalados.
     *
     * @param npmName - Nombre npm completo, p.e. `@mr/core-dev`.
     * @param tipo    - Tipo de paquete (`core`, `user`, `root`, `legacy`).
     * @param bucket  - Bucket GCS; por defecto `meteored-yarn-packages`.
     * @returns Nueva instancia virtual de `Paquete`.
     */
    public static buildVirtual(npmName: string, tipo: PaqueteTipo, bucket = "meteored-yarn-packages"): Paquete {
        return new this("", {
            name: npmName,
            version: "0.0.0+0",
            config: {
                subible: false,
                bucket,
                tipo,
            },
        });
    }

    /* INSTANCE */
    public readonly nombre: string;
    protected version: string;
    protected readonly config: IPaqueteCFG;
    private readonly gcs: PaqueteStorage;

    protected readonly consolaActual: string;
    protected readonly consolaOK: string;
    protected readonly consolaKO: string;
    protected consolaPadding: string;
    protected consolaIndex: number;
    protected consolaLength: number;
    protected consolaAvanzada: boolean;
    private consolaEscribiendo: boolean;
    public readonly logs: string[];
    public error: string | undefined;
    private _snapshot: ISnapshotPrevio | undefined;
    private _pushLogData: IPushLogData | undefined;

    protected constructor(protected readonly basedir: string, protected paquete: Partial<IPackageFW>) {
        if (paquete.name === undefined) {
            throw new Error(`El package.json de ${basedir} no tiene la propiedad "name"`);
        }
        this.nombre = paquete.name;
        this.version = paquete.version ?? "0.0.0.0+0";
        const config: Partial<IPaqueteCFG> = paquete.config ?? {};
        this.config = {
            subible: config.subible ?? true,
            bucket: config.bucket ?? "meteored-yarn-packages",
            tipo: config.tipo ?? PaqueteTipo.legacy,
        };

        const nombre = this.nombre.split("/").pop()!;
        let repo: string;
        switch(this.config.tipo) {
            case PaqueteTipo.root:
                if (!["client", "core", "legacy"].includes(nombre)) {
                    repo = `@mr/${nombre}`;
                } else {
                    repo = `@mr/legacy/${nombre}`;
                }
                break;

            case PaqueteTipo.core:
                repo = `@mr/core/${nombre}`;
                break;

            case PaqueteTipo.user:
                repo = `@mr/user/${nombre}`;
                break;

            default:
                repo = `@mr/legacy/${nombre}`;
                break;
        }
        this.gcs = new PaqueteStorage(this.config.bucket, repo, this.nombre, this.basedir);

        this.consolaActual = Colors.colorize([Colors.FgBlue], maquetarVersion(this.version));
        this.consolaOK = `[${Colors.colorize([Colors.FgGreen, Colors.Bright], "OK   ")}]`;
        this.consolaKO = `[${Colors.colorize([Colors.FgRed, Colors.Bright], "ERROR")}]`;
        this.consolaPadding = "";
        this.consolaIndex = 0;
        this.consolaLength = 1;
        this.consolaAvanzada = false;
        this.consolaEscribiendo = false;
        this.logs = [];
        this.error = undefined;
        this._snapshot = undefined;
        this._pushLogData = undefined;
    }

    /**
     * Ajusta el padding del nombre en la consola de progreso al ancho máximo `len`.
     *
     * @param len - Longitud máxima entre todos los nombres de paquete en la lista.
     */
    protected ajustarConsolaPadding(len: number): void {
        this.consolaPadding = " ".repeat(len - this.nombre.length);
    }

    /** Versión local actualmente instalada. */
    public get versionPublica(): string {
        return this.version;
    }

    /** `true` si el paquete está configurado para publicarse en GCS. */
    public get esSubible(): boolean {
        return this.config.subible;
    }

    /** Invalida el caché de versión remota para forzar una nueva consulta a GCS en la siguiente llamada. */
    public invalidarCacheVersion(): void {
        this.gcs.invalidarCache();
    }

    /** Descarga `stable.txt` del bucket y devuelve la versión remota más reciente, o `undefined` si no existe.
     *
     * @returns Versión remota más reciente, o `undefined` si no hay publicación.
     */
    public async getVersionRemota(): Promise<string | undefined> {
        return this.gcs.getLatest();
    }

    /** Devuelve (y cachea) el historial de versiones publicadas de `stable.txt`, o `[]` si no existe.
     *
     * @returns Lista de versiones publicadas (la más reciente en índice 0).
     */
    public getVersionesRemota(): Promise<string[]> {
        return this.gcs.getListaCache();
    }

    /**
     * Renderiza una línea de progreso en la consola para este paquete.
     *
     * @param config - Opciones de la línea: estado, si muestra la versión actual, nueva versión y mensaje.
     */
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
        if (nueva!==undefined) {
            salida.push(this.consolaNueva(nueva));
        } else {
            salida.push(" ".repeat(13));
        }
        salida.push(Colors.colorize([Colors.FgWhite, Colors.Bright], "]"));
        salida.push(STATUS[estado]);
        if (this.consolaAvanzada) {
            salida.push(Colors.down(this.consolaLength - this.consolaIndex - 1));
        }

        this.consolaEscribiendo = true;
        console.log(...salida);
        this.consolaEscribiendo = false;
    }

    /**
     * Formatea una versión con colores ANSI para mostrarla como "versión nueva" en la consola.
     *
     * @param version - Versión en formato `YYYY.MM.DD+INDEX`.
     * @returns Cadena de 13 caracteres coloreada en verde.
     */
    protected consolaNueva(version: string): string {
        return Colors.colorize([Colors.FgGreen], maquetarVersion(version));
    }

    private async reloadPaquete(): Promise<void> {
        this.paquete = await readJSON<Partial<IPackageFW>>(`${this.basedir}/package.json`);
    }

    private async savePaquete(): Promise<void> {
        await safeWrite(`${this.basedir}/package.json`, `${JSON.stringify(this.paquete, null, 2)}\n`, true, true);
    }

    /**
     * Descarga la última versión disponible de GCS y la aplica sobre el árbol local.
     * Si hay diferencias, muestra un prompt de confirmación (con timeout de 5 s) antes de aplicar.
     *
     * @param actualizar - Si `true`, omite el prompt de confirmación y actualiza directamente.
     * @returns `true` si la versión local fue actualizada.
     */
    public async pull(actualizar: boolean): Promise<boolean> {
        const latest = await this.gcs.getLatest();
        if (latest===undefined || !this.anticuado(latest)) {
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

        if (nuevo===undefined) {
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
        if (antiguo.status!==undefined) {
            status = antiguo.status.clone();
        } else {
            status = PaqueteDirectoryRoot.build(this.nombre, this.basedir);
            status.version = this.version;
        }

        const {actualizado} = await status.actualizarVersion(nuevo, antiguo);
        if (actualizado) {
            await this.reloadPaquete();
            this.version = status.version;
        }
        this._snapshot = undefined;

        return true;
    }

    /**
     * Calcula el hash del árbol local y, si hay cambios respecto del último ZIP publicado,
     * empaqueta y sube la nueva versión a GCS actualizando también `stable.txt`.
     * Si `Paquete.SIMULAR` está activo, solo actualiza `package.json` sin subir.
     *
     * @param autor - Nombre del autor que se registra en los metadatos de la versión.
     * @returns `true` si se subió una nueva versión.
     */
    public async push(autor: string): Promise<boolean> {
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

        const latest = await this.gcs.getLatest();

        if (latest!==undefined &&  this.anticuado(latest)) {
            this.consola({
                estado: ConsolaEstado.KO,
                actual: true,
                nueva: latest,
                mensaje: "Existe una nueva versión",
            });
            return false;
        }

        let status: PaqueteDirectoryRoot;
        let hayCambios: boolean;
        let antiguo: PaqueteDirectoryRootFiles;

        if (this._snapshot !== undefined) {
            ({hayCambios} = this._snapshot);
            status = this._snapshot.status;
            antiguo = this._snapshot.antiguo;
            if (hayCambios) {
                status.actualizarAutor(this._snapshot.versionBase, autor);
            }
            this._snapshot = undefined;
        } else {
            const actual = await this.getPaqueteAntiguo();
            antiguo = actual;
            if (actual.status !== undefined) {
                status = actual.status;
            } else {
                status = PaqueteDirectoryRoot.build(this.nombre, this.basedir);
                status.version = this.version;
            }
            hayCambios = await this.calcularHashCambiado(status, autor);
        }

        if (hayCambios) {
            for (const archivo of status.getArchivosCambiados()) {
                this.logs.push(archivo);
            }
        }

        if (!hayCambios && latest!==undefined && !this.adelantado(latest)) {
            this.consola({
                estado: ConsolaEstado.OK,
                actual: true,
                mensaje: "No hay cambios que subir",
            });
            return false;
        }

        this.consola({
            estado: ConsolaEstado.PENDING,
            actual: true,
            nueva: status.version,
            mensaje: "Subiendo la nueva versión"
        });

        if (!Paquete.SIMULAR) {
            const versionAnterior = this.version;
            if (hayCambios) {
                this._pushLogData = await this.capturarDatosPush(autor, status.version, versionAnterior, this.logs.slice(), antiguo);
            }
            this.version = status.version;
            await status.prepararParaPush(autor);
            this.paquete.version = this.version;
            await this.savePaquete();
            await this.gcs.subirPaquete(this.version, status);
            await this.gcs.subirLatest(this.version);
        } else {
            this.paquete.version = this.version;
            await this.savePaquete();
        }

        this.consola({
            estado: ConsolaEstado.OK,
            actual: true,
            nueva: status.version,
            mensaje: "Se ha subido la nueva versión",
        });

        return true;
    }

    /**
     * Descarga la última versión publicada en GCS y descarta todos los cambios locales,
     * restaurando el árbol de ficheros al estado exacto del ZIP remoto.
     *
     */

    public async reset(): Promise<void> {
        const latest = await this.gcs.getLatest();
        if (latest===undefined) {
            this.consola({
                estado: ConsolaEstado.KO,
                actual: true,
                mensaje: "No hay versión para resetear",
            });
            return;
        }

        const nuevo = await this.getPaqueteNuevo(latest);

        if (nuevo.status===undefined) {
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
        await this.reloadPaquete();
        this.version = this.paquete.version ?? nuevo.status.version;

        this.consola({
            estado: ConsolaEstado.OK,
            actual: false,
            nueva: latest,
            mensaje: "Reseteo completo",
        });
    }

    /**
     * Normaliza `package.json` a `version = "0.0.0+0"` antes de calcular el hash,
     * llama a `status.crearVersion` para comparar el árbol de ficheros con el hash almacenado
     * y restaura siempre `package.json` al salir.
     *
     * @param status - Status sobre el que se llama a `crearVersion`.
     * @param autor  - Autor para `crearVersion`; usar `"check"` para comprobaciones en seco.
     * @returns `true` si el árbol de ficheros difiere del hash almacenado en `status`.
     */
    private async calcularHashCambiado(status: PaqueteDirectoryRoot, autor: string): Promise<boolean> {
        await this.reloadPaquete();
        const versionAnterior = this.paquete.version;
        this.paquete.version = "0.0.0+0";
        delete this.paquete.hash;
        await this.savePaquete();
        try {
            return await status.crearVersion(autor);
        } finally {
            this.paquete.version = versionAnterior;
            await this.savePaquete();
        }
    }

    /**
     * Devuelve la lista de ficheros que han cambiado desde el último push, enriquecida
     * con el estado de cada fichero (`"cambiado"`, `"nuevo"` o `"eliminado"`).
     * Reutiliza el snapshot pre-calculado por {@link checkCambiosLocales} si está disponible.
     *
     * @returns Lista de `IArchivoCambiado`, o `null` si el paquete nunca fue publicado en GCS.
     */
    public async getArchivosCambiados(): Promise<IArchivoCambiado[] | null> {
        if (!this.config.subible || !this.basedir) {
            return [];
        }
        const antiguo = await this.getPaqueteAntiguo();
        if (antiguo.status === undefined) {
            return null;
        }
        let archivos: string[];
        if (this._snapshot !== undefined) {
            archivos = this._snapshot.status.getArchivosCambiados();
        } else {
            const statusClone = antiguo.status.clone();
            await this.calcularHashCambiado(statusClone, "check");
            archivos = statusClone.getArchivosCambiados();
        }

        // checkTipos() elimina del árbol los ficheros que ya no existen en disco antes de
        // que update() pueda marcarlos como cambiados. Los recuperamos comparando el status
        // original con lo que hay en disco.
        const archivosSet = new Set(archivos);
        const eliminadosExtra = (await Promise.all(
            antiguo.status.listarRutas()
                .filter(p => !archivosSet.has(p))
                .map(async p => (await isFile(`${this.basedir}/${p}`)) ? null : p),
        )).filter((p): p is string => p !== null);
        archivos = [...archivos, ...eliminadosExtra];

        return Promise.all(archivos.map(async (archivo) => {
            const enZip   = antiguo.files[archivo] !== undefined;
            const enDisco = await isFile(`${this.basedir}/${archivo}`);
            const estado  = !enDisco ? EstadoArchivo.Eliminado
                : !enZip  ? EstadoArchivo.Nuevo
                : EstadoArchivo.Cambiado;
            return {archivo, estado, origen: OrigenArchivo.Local};
        }));
    }

    /**
     * Obtiene el contenido original (último ZIP publicado en GCS) y el contenido
     * actual en disco del fichero indicado, para calcular un diff visual.
     *
     * @param relativePath - Ruta relativa al directorio raíz del paquete (p.ej. `src/index.ts`).
     * @returns `{original, nuevo}` o `null` si no se puede obtener el contenido.
     */
    public async getDiffFichero(relativePath: string): Promise<{original: string; nuevo: string; offsetOriginal: number; offsetNuevo: number; autor: string} | null> {
        if (!this.basedir) {
            return null;
        }
        const antiguo = await this.getPaqueteAntiguo();
        const zipFile = antiguo.files[relativePath];
        const esTs    = relativePath.endsWith(".ts");
        const rawOriginal = zipFile !== undefined
            ? await zipFile.async("text").catch(() => "")
            : "";
        const rawNuevo = await readFileString(`${this.basedir}/${relativePath}`).catch(() => null);
        if (rawNuevo === null) {
            return null;
        }
        const autor = antiguo.status?.getAutorArchivo(relativePath) ?? "";
        if (!esTs) {
            return {original: rawOriginal, nuevo: rawNuevo, offsetOriginal: 0, offsetNuevo: 0, autor};
        }
        const {texto: original, offset: offsetOriginal} = stripAutoriaConOffset(rawOriginal);
        const {texto: nuevo,    offset: offsetNuevo}    = stripAutoriaConOffset(rawNuevo);
        return {original, nuevo, offsetOriginal, offsetNuevo, autor};
    }

    /**
     * Obtiene el contenido del fichero local actual y el contenido del mismo fichero
     * en la versión remota indicada, para calcular un diff de la actualización pendiente.
     *
     * @param relativePath - Ruta relativa al directorio raíz del paquete.
     * @param latest       - Versión remota a consultar.
     * @returns `{original, nuevo}` o `null` si no está disponible.
     */
    public async getDiffFicheroDesdeRemoto(relativePath: string, latest: string): Promise<{original: string; nuevo: string; offsetOriginal: number; offsetNuevo: number; autor: string} | null> {
        if (!this.basedir) {
            return null;
        }
        const remoto   = await this.getPaqueteNuevo(latest);
        const zipFile  = remoto.files[relativePath];
        const esTs     = relativePath.endsWith(".ts");
        const rawLocal = await readFileString(`${this.basedir}/${relativePath}`).catch(() => "");
        const rawRemoto = zipFile !== undefined
            ? await zipFile.async("text").catch(() => "")
            : "";
        const autor = remoto.status?.getAutorArchivo(relativePath) ?? "";
        if (!esTs) {
            return {original: rawLocal, nuevo: rawRemoto, offsetOriginal: 0, offsetNuevo: 0, autor};
        }
        const {texto: original, offset: offsetOriginal} = stripAutoriaConOffset(rawLocal);
        const {texto: nuevo,    offset: offsetNuevo}    = stripAutoriaConOffset(rawRemoto);
        return {original, nuevo, offsetOriginal, offsetNuevo, autor};
    }

    /**
     * Devuelve la lista de ficheros que serían modificados por la actualización a la
     * versión indicada, enriquecida con el estado de cada fichero.
     *
     * @param latest - Versión remota a analizar.
     * @returns Lista de `IArchivoCambiado`, o `null` si no se puede acceder al ZIP remoto.
     */
    public async getArchivosModificadosPorUpdate(latest: string): Promise<IArchivoCambiado[] | null> {
        if (!this.basedir) {
            return null;
        }
        const remoto = await this.getPaqueteNuevo(latest);
        if (remoto.status === undefined) {
            return null;
        }
        const clone = remoto.status.clone();
        await clone.update(this.basedir, "check");
        const archivos = clone.getArchivosCambiados();

        // Igual que en getArchivosCambiados: checkTipos() elimina los ficheros del ZIP remoto
        // que no existen en disco antes de poder detectarlos. Los recuperamos aquí.
        const archivosSet = new Set(archivos);
        const nuevosExtra = (await Promise.all(
            remoto.status.listarRutas()
                .filter(p => !archivosSet.has(p))
                .map(async p => (await isFile(`${this.basedir}/${p}`)) ? null : p),
        )).filter((p): p is string => p !== null);
        const todosArchivos = [...archivos, ...nuevosExtra];

        return Promise.all(todosArchivos.map(async (archivo) => {
            const enRemoto = remoto.files[archivo] !== undefined;
            const enDisco  = await isFile(`${this.basedir}/${archivo}`);
            const estado   = enRemoto && !enDisco ? EstadoArchivo.Nuevo
                : !enRemoto && enDisco ? EstadoArchivo.Eliminado
                : EstadoArchivo.Cambiado;
            return {archivo, estado, origen: OrigenArchivo.Remoto};
        }));
    }

    /**
     * Devuelve la lista combinada de ficheros con cambios locales Y remotos para el caso
     * en que un framework tiene ambos pendientes a la vez. Cada fichero indica su origen:
     * `"local"` si solo hay cambio local, `"remoto"` si solo remoto, `"ambos"` si hay cambio en los dos.
     * Los ficheros con `"ambos"` aparecen primero, luego los locales, luego los remotos.
     *
     * @param latest - Versión remota a analizar.
     * @returns Lista combinada de `IArchivoCambiado`, o `null` si no hay datos disponibles.
     */
    public async getArchivosCambiadosCombinados(latest: string): Promise<IArchivoCambiado[] | null> {
        const [locales, remotos] = await Promise.all([
            this.getArchivosCambiados(),
            this.getArchivosModificadosPorUpdate(latest),
        ]);
        if (locales === null && remotos === null) {
            return null;
        }
        const localMap  = new Map((locales  ?? []).map(a => [a.archivo, a]));
        const remotoMap = new Map((remotos  ?? []).map(a => [a.archivo, a]));
        const resultado: IArchivoCambiado[] = [];
        for (const [archivo, item] of localMap) {
            const remotoItem = remotoMap.get(archivo);
            if (remotoItem !== undefined) {
                // Caso: local crea un fichero nuevo y remote no lo tiene → falso conflicto.
                // El update no borra ficheros locales que no estaban en el ZIP base, así que
                // este fichero simplemente no es conocido por el remoto. Mostrarlo como local-only.
                if (item.estado === EstadoArchivo.Nuevo && remotoItem.estado === EstadoArchivo.Eliminado) {
                    resultado.push({...item, origen: OrigenArchivo.Local});
                    continue;
                }
                // Caso: ambos lados lo eliminaron → no hay diff que ver.
                if (item.estado === EstadoArchivo.Eliminado && remotoItem.estado === EstadoArchivo.Eliminado) {
                    resultado.push({archivo, estado: EstadoArchivo.Eliminado, origen: OrigenArchivo.Ambos});
                    continue;
                }
                // Caso conflicto real:
                //   1) El usuario lo borró y el remoto lo trae.
                //   2) Ambos crearon el mismo fichero nuevo de forma independiente con distinto contenido
                //      (si fueran iguales, el fichero no aparecería en la lista remota).
                const conflicto = (item.estado === EstadoArchivo.Eliminado && remotoItem.estado === EstadoArchivo.Nuevo)
                    || (item.estado === EstadoArchivo.Nuevo && remotoItem.estado === EstadoArchivo.Cambiado);
                resultado.push({archivo, estado: EstadoArchivo.Cambiado, origen: OrigenArchivo.Ambos, conflicto: conflicto || undefined});
            } else {
                resultado.push({...item, origen: OrigenArchivo.Local});
            }
        }
        for (const [archivo, item] of remotoMap) {
            if (!localMap.has(archivo)) {
                resultado.push({...item, origen: OrigenArchivo.Remoto});
            }
        }
        const ORDEN: Record<string, number> = {
            [OrigenArchivo.Ambos]:  0,
            [OrigenArchivo.Local]:  1,
            [OrigenArchivo.Remoto]: 2,
        };
        resultado.sort((a, b) => ORDEN[a.origen] - ORDEN[b.origen] || a.archivo.localeCompare(b.archivo));
        return resultado;
    }

    /**
     * Comprueba si los ficheros locales del paquete difieren del último estado publicado en GCS.
     * Devuelve `true` si no existe ZIP publicado (paquete nuevo o nunca enviado).
     *
     * @returns `true` si hay cambios locales pendientes de enviar.
     */
    public async checkCambiosLocales(): Promise<boolean> {
        if (!this.config.subible || !this.basedir) {
            return false;
        }
        const antiguo = await this.getPaqueteAntiguo();
        if (antiguo.status === undefined) {
            this._snapshot = undefined;
            return true;
        }
        const versionBase = antiguo.status.version;
        const statusClone = antiguo.status.clone();
        const hayCambios = await this.calcularHashCambiado(statusClone, "check");
        this._snapshot = {status: statusClone, hayCambios, versionBase, antiguo};
        return hayCambios;
    }

    /**
     * Comprueba si hay una versión más reciente disponible sin aplicar cambios.
     *
     * @returns La versión remota más reciente si el paquete está anticuado, o `undefined` si está al día.
     */
    public async checkUpdate(): Promise<string | undefined> {
        const latest = await this.gcs.getLatest();
        if (latest === undefined || !this.anticuado(latest)) {
            return undefined;
        }
        return latest;
    }

    /**
     * Aplica la actualización a la versión indicada mediante diff3 sobre el árbol local.
     * La consola debe estar configurada previamente con `Paquete.setupConsolaParaUpdate`.
     *
     * @param latest - Versión remota a la que actualizar.
     * @returns Objeto con `cambio` (si el paquete fue actualizado), `conflictos` (si el merge 3-way
     *          produjo secciones en conflicto) y `entradas` (ficheros afectados).
     */
    public async applyUpdate(latest: string): Promise<{cambio: boolean; conflictos: boolean; entradas: IEntradaActualizacion[]}> {
        try {
            this.consola({
                estado: ConsolaEstado.PENDING,
                actual: true,
                nueva: latest,
                mensaje: "Descargando actualización",
            });

            const [antiguo, nuevo] = await Promise.all([
                this.getPaqueteAntiguo(),
                this.getPaqueteNuevo(latest),
            ]);

            if (nuevo.status === undefined) {
                this.consola({
                    estado: ConsolaEstado.KO,
                    actual: true,
                    nueva: latest,
                    mensaje: "Paquete no disponible",
                });
                return {cambio: false, conflictos: false, entradas: []};
            }

            let status: PaqueteDirectoryRoot;
            if (antiguo.status !== undefined) {
                status = antiguo.status.clone();
            } else {
                status = PaqueteDirectoryRoot.build(this.nombre, this.basedir);
                status.version = this.version;
            }

            const {actualizado, conflicto, entradas} = await status.actualizarVersion(nuevo, antiguo);
            if (actualizado) {
                await this.reloadPaquete();
                this.version = status.version;
            }
            this._snapshot = undefined;

            this.consola({
                estado: conflicto ? ConsolaEstado.CONFLICTO : ConsolaEstado.OK,
                actual: true,
                nueva: latest,
                mensaje: conflicto ? "Actualizado con conflictos" : "Actualizado correctamente",
            });

            return {cambio: actualizado, conflictos: conflicto, entradas};
        } catch (err) {
            this.consola({
                estado: ConsolaEstado.KO,
                actual: true,
                nueva: latest,
                mensaje: "Error durante la actualización",
            });
            if (err instanceof Error) {
                this.error = err.stack ?? err.message;
                this.logs.push(err.message);
            } else {
                this.error = String(err);
            }
            return {cambio: false, conflictos: false, entradas: []};
        }
    }

    /**
     * Genera la etiqueta formateada para el selector de actualizaciones.
     *
     * @param latest  - Versión remota disponible.
     * @param padding - Anchura mínima del nombre del paquete (para alinear columnas).
     * @returns Cadena con el nombre del paquete y las versiones actual y nueva coloreadas.
     */
    public etiquetaUpdate(latest: string, {padding = 0}: {padding?: number} = {}): string {
        const nombre = this.nombre + " ".repeat(Math.max(0, padding - this.nombre.length));
        return [
            Colors.colorize([Colors.FgMagenta], nombre),
            " ",
            this.consolaActual,
            Colors.colorize([Colors.FgWhite, Colors.Bright], " => "),
            this.consolaNueva(latest),
        ].join("");
    }

    /**
     * Configura la consola avanzada (cursor dinámico) para un conjunto de paquetes,
     * reservando una línea en blanco por paquete que será sobreescrita durante la operación.
     *
     * @param paquetes - Lista de paquetes para los que configurar la consola.
     */
    public static setupConsolaParaUpdate(paquetes: Paquete[]): void {
        if (paquetes.length === 0) {
            return;
        }
        const len = paquetes.reduce((acc, p) => Math.max(acc, p.nombre.length), 0);
        for (let i = 0; i < paquetes.length; i++) {
            paquetes[i].ajustarConsolaPadding(len);
            paquetes[i].consolaIndex = i;
            paquetes[i].consolaLength = paquetes.length;
            paquetes[i].consolaAvanzada = true;
            console.log("");
        }
    }

    /**
     * Recopila el estado y el contenido de cada fichero cambiado en este push para
     * generar el log HTML. Se llama justo antes de actualizar `this.version` y subir
     * el ZIP, de modo que `antiguo.files` aún contiene la versión anterior.
     *
     * @param autor          - Autor del push.
     * @param nuevaVersion   - Nueva versión que se va a publicar.
     * @param versionAnterior - Versión actualmente publicada.
     * @param archivos        - Rutas de los ficheros detectados como cambiados.
     * @param antiguo         - Contenido del ZIP de la versión anterior.
     */
    private async capturarDatosPush(autor: string, nuevaVersion: string, versionAnterior: string, archivos: string[], antiguo: PaqueteDirectoryRootFiles): Promise<IPushLogData> {
        const fecha = new Date();
        const [proyecto, archivosConDiff] = await Promise.all([
            getProyectoUrl(this.basedir),
            Promise.all(archivos.map(async (archivo): Promise<IArchivoConDiff> => {
                const enZip   = antiguo.files[archivo] !== undefined;
                const enDisco = await isFile(`${this.basedir}/${archivo}`);
                const esTs    = archivo.endsWith(".ts");

                let estado: IArchivoConDiff["estado"];
                let contenidoOriginal = "";
                let contenidoNuevo   = "";

                if (!enDisco) {
                    estado = "eliminado";
                    if (enZip) {
                        const raw = await antiguo.files[archivo].async("text").catch(() => "");
                        contenidoOriginal = esTs ? stripAutoria(raw) : raw;
                    }
                } else if (!enZip) {
                    estado = "nuevo";
                    const raw = await readFileString(`${this.basedir}/${archivo}`).catch(() => "");
                    contenidoNuevo = esTs ? stripAutoria(raw) : raw;
                } else {
                    estado = "cambiado";
                    const [rawOld, rawNew] = await Promise.all([
                        antiguo.files[archivo].async("text").catch(() => ""),
                        readFileString(`${this.basedir}/${archivo}`).catch(() => ""),
                    ]);
                    contenidoOriginal = esTs ? stripAutoria(rawOld) : rawOld;
                    contenidoNuevo   = esTs ? stripAutoria(rawNew)  : rawNew;
                }

                return {archivo, estado, contenidoOriginal, contenidoNuevo};
            })),
        ]);

        return {
            autor,
            version: nuevaVersion,
            versionAnterior,
            npmName: this.nombre,
            proyecto,
            fecha,
            archivos: archivosConDiff,
        };
    }

    /**
     * Genera el log HTML del último push y lo sube al bucket GCS.
     * No hace nada si no hay datos de push pendientes de subir.
     */
    public async subirLogHtml(): Promise<void> {
        if (this._pushLogData === undefined) {
            return;
        }
        const data = this._pushLogData;
        this._pushLogData = undefined;
        await subirLogHtmlPush(this.config.bucket, data);
    }

    private anticuado(remota: string): boolean {
        return compararVersiones(this.version, remota) < 0;
    }

    private adelantado(remota: string): boolean {
        return compararVersiones(this.version, remota) > 0;
    }

    private getPaqueteAntiguo(): Promise<PaqueteDirectoryRootFiles> {
        return this.gcs.getZIP(`stable-${this.version}`);
    }

    private getPaqueteNuevo(version: string): Promise<PaqueteDirectoryRootFiles> {
        return this.gcs.getZIP(`stable-${version}`);
    }
}
