import {FSWatcher, watch } from "node:fs";
import os from "node:os";

export interface IWorkspace {
    nombre: string;
    path: string;
    root: string;
}

export class Workspace {
    /* STATIC */

    /* INSTANCE */
    protected readonly nombre: string;
    protected readonly root: string;
    protected readonly dir: string;
    protected readonly hijos: Workspace[];

    protected iniciado: boolean;
    protected watcher?: FSWatcher;

    public constructor(data: IWorkspace) {
        this.nombre = data.nombre;
        this.root = data.root;
        this.dir = `${data.root}/${data.path}/${data.nombre}`;
        this.hijos = [];

        this.iniciado = false;
    }

    public addHijo(ws: Workspace): void {
        this.hijos.push(ws);
    }

    public async init(): Promise<void> {
        if (this.iniciado) {
            return;
        }
        this.iniciado = true;

        await this.run();

        this.initWatcher();
    }

    protected initWatcher(): void {
        this.watcher?.close();
        if (os.platform()!="linux") {
            this.watcher = watch(this.dir, {recursive: true}, (ev, filename) => {
                if (filename?.endsWith("~")) {
                    return;
                }

                this.cambio();
            });
        }
    }

    public cambio(): void {
        for (const actual of this.hijos) {
            actual.cambio();
        }
    }

    protected async run(): Promise<void> {

    }
}
