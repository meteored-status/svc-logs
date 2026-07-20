/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 17 Jul 2026 10:46:55 GMT
 * Hash: b20b5995e67d21e2b7936b11426bef15
 * Versión: 2026.7.17+1-josantoniojimnez
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import chokidar, {type FSWatcher} from "chokidar";
import type {ChildProcessWithoutNullStreams} from "node:child_process";
import treeKill from "tree-kill";

import {Deferred} from "services-comun/modules/utiles/promise";

import {Log} from "./log";

/**
 * Datos básicos de un workspace del monorepo.
 *
 * @property nombre - Nombre del workspace (directorio).
 * @property path   - Subdirectorio relativo a `root` donde se aloja el workspace (p.ej. `"services"`). Opcional.
 * @property root   - Raíz absoluta del monorepo.
 * @property watch  - Si `true`, se registra el watcher de ficheros del workspace. Si `false`,
 *   el workspace no observa cambios (compilación/ejecución de una sola vez).
 */
export interface IWorkspace {
    nombre: string;
    path?: string;
    root: string;
    watch: boolean;
}

/**
 * Clase base para cualquier workspace del monorepo.
 * Gestiona el watcher de ficheros y propaga los eventos de cambio a sus workspaces dependientes.
 */
export class Workspace {
    /* STATIC */

    /* INSTANCE */
    protected readonly nombre: string;
    protected readonly root: string;
    protected readonly dir: string;
    protected readonly hijos: Workspace[];
    protected readonly watch: boolean;

    protected iniciado: boolean;
    protected watcher?: FSWatcher;

    public constructor(data: IWorkspace) {
        this.nombre = data.nombre;
        this.root = data.root;
        this.dir = data.path!=undefined ? `${data.root}/${data.path}/${data.nombre}` : `${data.root}/${data.nombre}`;
        this.hijos = [];
        this.watch = data.watch;

        this.iniciado = false;
    }

    /**
     * Registra un workspace dependiente que será notificado cuando este workspace cambie.
     *
     * @param ws - Workspace hijo a añadir.
     */
    public addHijo(ws: Workspace): void {
        this.hijos.push(ws);
    }

    /**
     * Inicia el workspace si aún no está iniciado: ejecuta `run()` y arranca el watcher.
     * Llamadas posteriores a un workspace ya iniciado son no-ops.
     *
     */
    public async init(): Promise<void> {
        if (this.iniciado) {
            return;
        }
        this.iniciado = true;

        await this.run();

        if (this.watch) {
            this.initWatcher();
        }
    }

    public parar(): void {
        this.watcher?.close();
    }

    protected initWatcher(): void {
        this.parar();
        this.watcher = chokidar.watch(this.dir, {
            persistent: true,
            ignored: (path)=>path.endsWith("~"),
        }).on("change", () => {
            this.cambio();
        });
    }

    public cambio(): void {
        for (const actual of this.hijos) {
            actual.cambio();
        }
    }

    /**
     * Tarea principal del workspace que se ejecuta al iniciarlo y tras cada cambio detectado.
     * Las subclases deben sobreescribir este método para implementar la compilación.
     *
     */
    protected async run(): Promise<void> {
        // compilar
    }

    /**
     * Detiene un proceso hijo en ejecución (compilador o ejecución) usando `tree-kill`,
     * logueando el resultado con la etiqueta indicada. No-op si `proceso` es `undefined`.
     *
     * @param proceso    - Proceso a detener, o `undefined` si no hay ninguno en marcha.
     * @param log        - Configuración de log (`type`/`label`) y `accion` descrita en los mensajes.
     * @param onDetenido - Callback invocado tras detener el proceso con éxito, para que el
     *   llamador limpie su propia referencia al proceso.
     */
    protected async detenerProceso(proceso: ChildProcessWithoutNullStreams|undefined, log: {type: string, label: string, accion: string}, onDetenido: () => void): Promise<void> {
        if (proceso==undefined) {
            return;
        }

        Log.info({type: log.type, label: log.label}, `Deteniendo ${log.accion} (`, proceso.pid, ")");
        if (proceso.pid == undefined) {
            return;
        }

        const deferred = new Deferred<void>();
        treeKill(proceso.pid, (err) => {
            if (err) {
                Log.error({type: log.type, label: log.label}, `Deteniendo ${log.accion} => KO`, err);
                deferred.reject(err);
            } else {
                Log.info({type: log.type, label: log.label}, `Deteniendo ${log.accion} => OK`);
                onDetenido();
                deferred.resolve();
            }
        });

        return deferred.promise;
    }
}
