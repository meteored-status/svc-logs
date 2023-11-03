import {ConfigCache} from "./config";

export interface ICacheMetadata {
    borrada: boolean;
    expiracion?: string;
    subcache?: string[];
    extra?: TExtra;
}

export type TExtra = NodeJS.Dict<string|number|boolean>;
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
    /* STATIC */

    /* INSTANCE */
    public constructor(protected readonly config: ConfigCache) {
    }

    public abstract get({key, control}: ICacheGetOptions): Promise<ICacheAdapter<T>>;
    public abstract set({key, control, value, metadata}: ICacheSetOptions<T>): Promise<void>;
}
