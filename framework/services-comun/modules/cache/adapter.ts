/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 0182741db1b56472f375b468b6d10c94
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {ConfigCache} from "./config";

export interface ICacheMetadata {
    borrada: boolean;
    expiracion?: string;
    subcache?: string[];
    extra?: TExtra;
}

export type TExtra = Record<string, string|number|boolean|undefined>;
export type TExtraChecker = (extra?: TExtra)=>boolean;

export interface ICacheAdapter<T extends ICacheMetadata> {
    value: string;
    metadata: T;
}

export interface ICacheGetOptions {
    key: string;
    control?: string;
}

export interface ICacheSetOptions<T extends ICacheMetadata=ICacheMetadata> extends ICacheGetOptions {
    value: string;
    metadata: T;
}

export abstract class CacheAdapter<T extends ICacheMetadata=ICacheMetadata> {
    /* INSTANCE */
    public constructor(protected readonly config: ConfigCache) {
    }

    public abstract get({key, control}: ICacheGetOptions): Promise<ICacheAdapter<T>>;
    public abstract set({key, control, value, metadata}: ICacheSetOptions<T>): Promise<void>;
}
