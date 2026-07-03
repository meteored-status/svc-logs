/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 13:19:30 GMT
 * Hash: 2a2e8a497c383417a8860a77c341608f
 * Versión: 2026.6.17+1-josantoniojimnez
 * Anterior: 2026.6.11+1-josantoniojimnez
 */

import {type FTemplate, type IConfigPlantilla, Plantilla, type ITemplateOptions as IOptions} from ".";

export interface IConfigComponente extends IConfigPlantilla {
    expires?: number;
    dominios: {
        cmp: string;
        services: string;
        www: string;
    };
}

export type {IOptions};

export abstract class Componente<P extends IOptions, T extends IConfigComponente = IConfigComponente> extends Plantilla<P, T> {
    /* INSTANCE */
    protected constructor(config: T, tmpl: FTemplate<P>) {
        super(config, tmpl);

        if (this.config.expires) {
            this.expiraciones.push(this.config.expires);
        }
    }
}
