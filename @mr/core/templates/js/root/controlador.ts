/**
 * Editor: miguel
 * Fecha: Mon, 22 Jun 2026 08:02:44 GMT
 * Hash: e9ca20b5e7b8f9e4f9c8e54138ed8c4e
 * Versión: 2026.6.22+1-miguel
 * Anterior: 2026.6.18+1-miguel
 */

import {IConf} from "../utiles/config";

export interface IControlador<T = IConf> {
    cfg: T;
    element: HTMLElement;
    selector: string;
}

export abstract class Controlador<T extends IControlador = IControlador> {
    /* INSTANCE */
    public ejecutando: boolean;
    public primeraEjecucion: boolean;

    protected get element(): HTMLElement { return this.ctx.element; }

    protected constructor (protected ctx: T) {
        this.ejecutando = false;
        this.primeraEjecucion = true;
    }

    public async afterRun(): Promise<void> {
        this.ejecutando = false;
        this.primeraEjecucion = false;
    }
    public async beforeRun(): Promise<void> {
        this.ejecutando = true;
    }
    public async errorRun(): Promise<void> {
        this.ejecutando = false;
    }

    public async run(): Promise<void> {/* para sobreescribir */}
    public async runOnce(): Promise<void> {/* para sobreescribir */}
}
