import {CacheAdapter, ICacheGetOptions, ICacheMetadata, TExtra, TExtraChecker} from "../cache/adapter";
import {CacheAdapterDisk} from "../cache/adapter/disk";
import {ConfigCache} from "../cache/config";
import {error} from "../utiles/log";
import {logCall, logRejection} from "../decorators/metodo";

export enum TDevice {
    pc = "pc",
    mv = "mv",
}

export interface IConfigPlantilla {
    extra?: TExtra;
    extraChecker?: TExtraChecker;
}

export interface IParametros {
}

export type FPlantilla = (parametros: IParametros)=>string;

interface ICacheData extends ICacheMetadata {
    lastModified?: string;
    cacheTags?: string[];
    subCacheControl?: string[];
}

export abstract class Plantilla<T extends IConfigPlantilla = IConfigPlantilla> {
    /* STATIC */

    /* INSTANCE */
    public contenido: string;
    public expiracion?: Date;
    public lastModified?: Date;
    public cacheTags?: string[];
    private subCacheControl?: string[];
    private cacheAdapter: CacheAdapter<ICacheData>;
    protected readonly expiraciones: number[];
    protected readonly modificaciones: number[];

    protected constructor(protected readonly cache: ConfigCache, protected readonly config: T) {
        this.contenido = "";
        this.expiraciones = [];
        this.modificaciones = [];

        this.cacheAdapter = new CacheAdapterDisk(cache);
    }

    protected async loadModulo<K extends Plantilla>(modulop: Promise<K>): Promise<K> {
        const modulo = await modulop;

        await modulo.render();

        this.addExpiracion(modulo.expiracion);
        this.addLastModified(modulo.lastModified);
        this.addCacheTags(modulo.cacheTags);
        this.addSubcache(await modulo.getCacheControl());

        return modulo;
    }

    protected addLastModified(last?: Date): void {
        if (last!=undefined) {
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

    protected addSubcache(subcache: string): void {
        (this.subCacheControl??=[]).push(subcache);
    }

    protected addSubcaches(subcaches?: string[]): void {
        if (subcaches!=undefined) {
            (this.subCacheControl ??= []).push(...subcaches);
        }
    }

    private async aCache({control, key}: ICacheGetOptions): Promise<void> {
        this.cacheAdapter.set({control, key, value:this.contenido, metadata:{
            borrada: false,
            expiracion: this.expiracion?.toISOString(),
            lastModified: this.lastModified?.toISOString(),
            cacheTags: this.cacheTags,
            subCacheControl: this.subCacheControl,
            extra: this.config.extra,
        }}).catch(async (err)=>{
            error("Error guardando cache", JSON.stringify(err));
        });
    }

    private async deCache({control, key}: ICacheGetOptions): Promise<void> {
        const {value, metadata} = await this.cacheAdapter.get({control, key});

        if (this.config.extraChecker!=undefined && !this.config.extraChecker(metadata.extra)) {
            return Promise.reject("La caché no es válida");
        }

        this.contenido = value;
        if (metadata.expiracion != undefined) {
            this.expiracion = new Date(metadata.expiracion);
        }
        if (metadata.lastModified != undefined) {
            this.lastModified = new Date(metadata.lastModified);
        }
        this.addCacheTags(metadata.cacheTags);
        this.addSubcaches(metadata.subCacheControl);
    }

    protected async renderizar(): Promise<string> {
        const [
            plantilla,
            parametros,
        ] = await Promise.all([
            this.getPlantilla(),
            this.getParametros(),
        ]);

        return plantilla(parametros);
    }

    private async renderEjecutar({control, key}: ICacheGetOptions): Promise<void> {
        this.contenido = await this.renderizar();
        [
            this.expiracion,
            this.lastModified
        ] = await Promise.all([
            this.calcularExpiracion(),
            this.calcularLastModified(),
        ]);

        this.aCache({control, key}).then(async () => {}).catch(async (err) => {
            error(`Error guardando caché`, err);
        });
    }

    @logRejection()
    public async render(): Promise<void> {
        const [control, key] = await Promise.all([
            this.getCacheControl(),
            this.getCacheContent(),
        ]);

        await this.deCache({control, key}).catch(async ()=>{
            await this.renderEjecutar({control, key});
        });
    }

    @logCall()
    public panic(e: any): void {
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

    protected abstract getParametros(): Promise<IParametros>;
    protected abstract getPlantilla(): Promise<FPlantilla>;
    public abstract getCacheControl(): Promise<string>;
    protected abstract getCacheContent(): Promise<string>;
}
