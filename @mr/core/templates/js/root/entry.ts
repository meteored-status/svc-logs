/**
 * Editor: miguel
 * Fecha: Fri, 26 Jun 2026 07:14:24 GMT
 * Hash: e5a4a0504db4fe4b2fd546bc48a8a014
 * Versión: 2026.6.26+1-miguel
 * Anterior: 2026.6.18+1-miguel
 */

import {PromiseDelayed} from "services-comun/modules/browser/promise";
import type {Prioridad} from "services-comun/modules/browser/scheduler";
import {error} from "services-comun/modules/browser/log";

import type {IConf} from "../utiles/config";
import type {IModuloBuilder, Modulo} from "./modulo";
import {ModuloError} from "./modulo/error";
import type {TDevice} from "@mr/core-templates/device";

export type TEntry = (entry: Entry)=>void;

export interface ILoader {
    default: IModuloBuilder;
}

interface IModuleCfg {
    priority?: Prioridad;
    selector?: {
        some?: string[];
        all?: string[];
    };
    on?: {
        event: string;
        selector: string;
    };
    device?: {
        include?: TDevice[];
        exclude?: TDevice[];
    };
    section?: {
        include?: string[];
        exclude?: string[];
    };
}

export class Entry {
    /* INSTANCE */
    private executed: boolean;
    private readonly modulos: Map<symbol, Modulo>;
    private readonly pendientes: Record<string, IModuleCfg>;

    public constructor(document: Document, private readonly config: IConf) {
        this.executed = false;
        this.modulos = new Map<symbol, Modulo>();
        this.pendientes = {};

        if (document.readyState==="loading") {
            // `DOMContentLoaded` todavía no se ha disparado
            document.addEventListener("DOMContentLoaded", ()=>{
                this.run();
            });
        } else {
            // `DOMContentLoaded` ya se ha disparado
            this.run();
        }
    }

    public getModulePath(modulo: string): string {
        if (modulo.startsWith("@mr")) {
            return modulo;
        }
        return `../modulos/${modulo}`;
    }

    protected async loadModule(fullPath: string): Promise<ILoader> {
        return import(/* webpackChunkName: "module/[request]" */ `${fullPath}`) as Promise<ILoader>;
    }

    private run(): void {
        const pendientes = Object.keys(this.pendientes);
        for (const pendiente of pendientes) {
            this.parsePendiente(pendiente, this.pendientes[pendiente]);
        }
        this.executed = true;
        for (const id of this.modulos.keys()) {
            this.runModulo(id).then(()=>{});
        }
    }

    private parsePendiente(modulo: string, {priority, selector, on}: IModuleCfg): void {
        if (!selector) {
            return;
        }

        for (const actual of selector.all??[]) {
            const elements = document.querySelectorAll(actual);
            if (elements.length===0) {
                return;
            }
        }
        if (selector.some) {
            let ok = 0;
            for (const actual of selector.some) {
                const elements = document.querySelectorAll(actual);
                if (elements.length > 0) {
                    ok++;
                }
            }
            if (ok === 0) {
                return;
            }
        }
        this.add(modulo, {priority, on});
    }

    public load(...loaders: TEntry[]): Entry {
        for (const loader of loaders) {
            loader(this);
        }

        return this;
    }

    // public add(modulo: string, {device, priority, selector, section, on}: IModuleCfg={}): Entry {
    public add(modulo: string, { device, priority, selector, section, on}: IModuleCfg={}): Entry {
        if (section) {
            if (section.include && !section.include.includes(this.config.section)) {
                return this;
            }
            if (section.exclude?.includes(this.config.section)) {
                return this;
            }
        }
        if (device) {
            if (device.include && !device.include.includes(this.config.device)) {
                return this;
            }
            if (device.exclude?.includes(this.config.device)) {
                return this;
            }
        }

        const fullPath = this.getModulePath(modulo);

        if (on) {
            const elements = document.querySelectorAll(on.selector);

            if (elements.length === 0) {
                return this;
            }

            const handler = async () => {
                elements.forEach(el => el.removeEventListener(on.event, handler));

                try {
                    const { default: moduloLoader }: ILoader =
                        await this.loadModule(fullPath);

                    await PromiseDelayed(0, priority);

                    this.addModulo(...await moduloLoader.build({
                        global: this.config,
                        document,
                        window,
                    }));
                } catch (err) {
                }
            };

            elements.forEach(el => el.addEventListener(on.event, handler));

            return this;
        }

        if (selector) {
            if (!this.executed) {
                this.pendientes[modulo] = {priority, selector};
            } else {
                this.parsePendiente(modulo, {priority, selector});
            }
        } else {
            this.loadModule(`${fullPath}/`)
                .then(async ({default: modulo}: ILoader) => {
                    await PromiseDelayed(0, priority);

                    this.addModulo(...await modulo.build({
                        global: this.config,
                        document,
                        window,
                    }));
                })
                .catch((err) => {
                    error("Error loading module::", modulo, JSON.stringify(err), err);
                });
        }

        return this;
    }

    protected addModulo(...modulos: Modulo[]): void {
        for (const modulo of modulos) {
            this.modulos.set(modulo.uid, modulo);
            if (this.executed) {
                this.runModulo(modulo.uid).then(()=>{});
            }
        }
    }

    private async runModulo(id: symbol): Promise<void> {
        const modulo = this.modulos.get(id);
        if (modulo==undefined) {
            return;
        }

        try {
            await modulo.init();
        } catch (err) {
            ModuloError.show(modulo, err);
            this.modulos.delete(id);
        }
    }
}
