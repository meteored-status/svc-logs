/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 13:19:30 GMT
 * Hash: a3cdc5341412bc76eec95ee5d614d254
 * Versión: 2026.6.17+7-josantoniojimnez
 */

import {type ITranslation, type TParams, Translation} from ".";

export interface ITraduccionMapKeys {
    [key: string]: string|undefined;
}

export type ITraduccionMapValores<K extends ITraduccionMapKeys> = Record<keyof K, string>;

export class TraduccionMap<K extends ITraduccionMapKeys=ITraduccionMapKeys, T extends TParams={}> extends Translation<T> {
    /* INSTANCE */
    public constructor(cfg: ITranslation, protected readonly valores: ITraduccionMapValores<K>, protected readonly defecto?: string) {
        super(cfg);
    }

    public render(key: keyof K, params?: Partial<T>): string {
        return this.aplicarParams(this.valores[key]??this.defecto??`${this.id.toUpperCase()}["${String(key)}"]`, params);
    }
}
