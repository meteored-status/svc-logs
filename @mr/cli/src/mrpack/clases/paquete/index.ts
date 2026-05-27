/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: d1c64f87540799131d84cb6481601ef7
 * Versión: 2026.5.27+1-josantoniojimnez
 * Anterior: 2026.5.25+1-josantoniojimnez
 */

import {confirm} from "@inquirer/prompts";

import {isDir, readDir, readJSON, safeWrite} from "services-comun/modules/utiles/fs";

import {compararVersiones, maquetarVersion} from "../../utiles/version";
import {Colors} from "../colors";
import type {IPackageJson} from "../packagejson";
import {PaqueteDirectoryRoot, type PaqueteDirectoryRootFiles} from "./root";
import {PaqueteStorage} from "./storage";

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
 */
interface ISnapshotPrevio {
    status: PaqueteDirectoryRoot;
    hayCambios: boolean;
    versionBase: string;
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
        for (const dir of coreDirs)   paquetes.push(this.build(`${basedir}/@mr/core/${dir}`));
        for (const dir of userDirs)   paquetes.push(this.build(`${basedir}/@mr/user/${dir}`));
        for (const dir of fwDirs)     paquetes.push(this.build(`${basedir}/framework/${dir}`));

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
    private _snapshot: ISnapshotPrevio | undefined;

    protected constructor(protected readonly basedir: string, protected paquete: Partial<IPackageFW>) {
        this.nombre = paquete.name!;
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
        this._snapshot = undefined;
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

        if (this._snapshot !== undefined) {
            ({hayCambios} = this._snapshot);
            status = this._snapshot.status;
            if (hayCambios) {
                status.actualizarAutor(this._snapshot.versionBase, autor);
            }
            this._snapshot = undefined;
        } else {
            const actual = await this.getPaqueteAntiguo();
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
        this._snapshot = {status: statusClone, hayCambios, versionBase};
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
    public async applyUpdate(latest: string): Promise<{cambio: boolean; conflictos: boolean; entradas: {archivo: string; estado: "ok" | "error"}[]}> {
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
                this.logs.push(err.message);
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
