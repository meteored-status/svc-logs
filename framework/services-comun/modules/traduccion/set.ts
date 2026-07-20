/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 13:19:30 GMT
 * Hash: a5d70904463cfb1e4b52899f3a77adc8
 * Versión: 2026.6.17+7-josantoniojimnez
 */

import {type ITranslation, type TParams, Translation} from ".";

export type TValor = string | null;

export class TraduccionSet<T extends TParams={}> extends Translation<T> {
    /* INSTANCE */
    public constructor(cfg: ITranslation, protected readonly valores: TValor[], protected readonly defecto?: string) {
        super(cfg);
    }

    public render(i: number, params?: Partial<T>): string {
        return this.aplicarParams(this.valores[i]??this.defecto??`${this.id.toUpperCase()}[${i}]`, params);
    }
}
