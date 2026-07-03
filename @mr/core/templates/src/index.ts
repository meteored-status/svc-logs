/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 13:19:30 GMT
 * Hash: 1e22c81f48c568cc50bb58aecdb2302e
 * Versión: 2026.6.17+1-josantoniojimnez
 * Anterior: 2026.6.11+1-josantoniojimnez
 */

import type {Idioma} from "@mr/core-network/server/http/i18n.ts";
import type {Route, TParams} from "@mr/core-network/route";
import {logCall, logRejection} from "services-comun/modules/decorators/metodo";

import type {TDevice} from "./device";

export interface IConfigPlantilla {
    lang: Idioma;
    device: TDevice;
    section: Route;
    params: TParams;
}

export interface ITemplateOptions {
    bloques?: Record<string, string>;
}

export type FTemplate<T extends ITemplateOptions> = (opt: T)=>string;

/**
 * Contrato mínimo exigido por {@link Plantilla.loadModulo} y {@link Plantilla.finishModulo}.
 *
 * @property render       - Renderiza el componente y rellena `contenido`.
 * @property expiracion   - Fecha de expiración calculada tras el render.
 * @property lastModified - Fecha de última modificación calculada tras el render.
 * @property cacheTags    - Etiquetas de caché asociadas al resultado renderizado.
 */
export interface IPlantilla {
    render(): Promise<void>;
    expiracion?: Date;
    lastModified?: Date;
    cacheTags?: string[];
}

export abstract class Plantilla<P extends ITemplateOptions = ITemplateOptions, T extends IConfigPlantilla = IConfigPlantilla> implements IPlantilla {
    /* INSTANCE */
    public contenido: string;
    public expiracion?: Date;
    public lastModified?: Date;
    public cacheTags?: string[];
    protected readonly expiraciones: number[];
    protected readonly modificaciones: number[];

    protected constructor(protected readonly config: T, protected readonly tmpl: FTemplate<P>) {
        this.contenido = "";
        this.expiraciones = [];
        this.modificaciones = [];
    }

    protected async loadModulo<K extends IPlantilla>(modulop: Promise<K>, {finish = true}: {finish?: boolean} = {}): Promise<K> {
        const modulo = await modulop;

        if (!finish) {
            return modulo;
        }

        await this.finishModulo(modulo);

        return modulo;
    }

    protected async finishModulo<K extends IPlantilla>(modulo: K): Promise<K> {
        await modulo.render();

        this.addExpiracion(modulo.expiracion);
        this.addLastModified(modulo.lastModified);
        this.addCacheTags(modulo.cacheTags);

        return modulo;
    }

    protected addLastModified(last?: Date): void {
        if (last) {
            this.modificaciones.push(last.getTime());
        }
    }

    protected addCacheTags(tags?: string[]): void {
        this.cacheTags??=[];
        for (const tag of tags??[]) {
            if (!this.cacheTags.includes(tag)) {
                this.cacheTags.push(tag);
            }
        }
    }

    protected async renderizar(): Promise<string> {
        return this.tmpl(await this.getParametros());
    }

    protected async renderEjecutar(): Promise<void> {
        this.contenido = await this.renderizar();
        [
            this.expiracion,
            this.lastModified
        ] = await Promise.all([
            this.calcularExpiracion(),
            this.calcularLastModified(),
        ]);
    }

    @logRejection()
    public async render(): Promise<void> {
        await this.renderEjecutar();
    }

    @logCall()
    public panic(e: unknown): void {
        this.contenido = `Error de página<br>${JSON.stringify(e)}`;
        this.expiracion = new Date(Date.now()-3600000);
        this.lastModified = undefined;
        this.cacheTags = undefined;
    }

    protected addExpiracion(expiracion?: Date): void {
        if (expiracion!=undefined) {
            this.expiraciones.push(expiracion.getTime());
        }
    }

    private async calcularExpiracion(): Promise<Date|undefined> {
        const expiracion = this.expiraciones;
        if (expiracion.length>0) {
            return new Date(Math.min(...expiracion));
        }

        return undefined;
    }

    private async calcularLastModified(): Promise<Date|undefined> {
        const modificaciones = this.modificaciones;
        if (modificaciones.length>0) {
            return new Date(Math.max(...modificaciones));
        }

        return undefined;
    }

    public toString(): string {
        return this.contenido;
    }

    protected abstract getParametros(): Promise<P>;
}
