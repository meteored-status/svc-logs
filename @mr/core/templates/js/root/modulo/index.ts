/**
 * Editor: miguel
 * Fecha: Mon, 22 Jun 2026 08:02:44 GMT
 * Hash: f1fa3da07360c909cb2a149ca601e071
 * Versión: 2026.6.22+1-miguel
 * Anterior: 2026.6.18+1-miguel
 */

import type {Prioridad} from "services-comun/modules/browser/scheduler";
import {PromiseDelayed} from "services-comun/modules/browser/promise";
import {info} from "services-comun/modules/browser/log";

import type {Controlador} from "../controlador";
import type {IConf} from "../../utiles/config";
import {ModuloError} from "./error";

export interface IModuloBase<T = IConf> {
    global: T;
    document: Document;
    window: Window;
}

export interface IModuloBuilder {
    build(cfg: IModuloBase): Promise<Modulo[]>;
}

export interface IModulo<T = IConf> extends IModuloBase<T> {
    id: string;
    selector: string;
    prioridad?: Prioridad;
}

export abstract class Modulo<T extends IModulo = IModulo> {
    /* STATIC */

    /* INSTANCE */
    public uid: symbol;
    protected elements: HTMLElement[];
    protected controllers: Map<Element, Controlador|undefined>;
    private error?: Error;
    private executed: boolean;

    public get id(): string { return this.cfg.id; }
    public get enabled(): boolean { return this.elements.length > 0; }
    public get disabled(): boolean { return this.elements.length == 0; }
    public get length(): number { return this.elements.length; }
    public readonly nombre: string;

    protected constructor(protected cfg: T) {
        this.uid = Symbol(this.cfg.id);
        this.elements = [];
        // this.elements = Modulo.NODE_DEFAULT;
        this.controllers = new Map<Element, Controlador|undefined>();
        this.executed = false;

        this.nombre = `${this.cfg.id}[${this.cfg.selector}]`;
    }

    public async init(): Promise<void> {
        if (this.error) {
            return Promise.reject(this.error);
        }
        if (this.executed) {
            return;
        }

        await PromiseDelayed(0, this.cfg.prioridad);

        this.executed = true;
        this.elements = Array.from(document.querySelectorAll(this.cfg.selector));

        info(this.nombre, "Iniciando");

        if (this.disabled) {
            this.error = ModuloError.info(`No hay elementos`);
            return Promise.reject(this.error);
        }

        try {
            await this.run();
        } catch (err) {
            if (err instanceof Error) {
                this.error = err;
            } else {
                this.error = ModuloError.error(`Error ejecutando el módulo ${JSON.stringify(err)}`);
            }

            return Promise.reject(this.error);
        }

    }

    private async run(): Promise<void> {
        if (this.disabled) {
            return;
        }

        await Promise.all(Array.from(this.elements).map(element => this.runElement(element)));
    }

    protected async runElement(element: HTMLElement): Promise<void> {
        let controller = this.controllers.get(element);
        try {
            if (!controller) {
                info(this.nombre, "Obteniendo controlador");
                controller = await this.controller(element);
                this.controllers.set(element, controller);
            }
            if (controller.ejecutando) {
                return;
            }
            info(this.nombre, "Ejecutando");
            await controller.beforeRun();
            if (controller.primeraEjecucion) {
                await controller.runOnce();
            }
            await controller.run();
            await controller.afterRun();
        } catch (err) {
            await controller?.errorRun();
            ModuloError.show(this, err);
        }
    }

    protected abstract controller(element: HTMLElement): Promise<Controlador>;
}
