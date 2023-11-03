import {OutgoingHttpHeaders} from "node:http";
import {Conexion} from "../conexion";
import {RequestResponse} from "../request";

export interface IRouteGroupCache {
    enabled: boolean;
    handler?: NetCache;
    device: boolean; // cachear por device/type
}

export type INetCache = INetCacheV1;

export interface INetCacheV1 {
    version: 1;
    expires: number;
    code: number;
    headers: OutgoingHttpHeaders;
}

export abstract class NetCache {
    /* STATIC */

    /* INSTANCE */
    protected constructor() {

    }

    // private async checkConexion(conexion: Conexion): Promise<void> {
    // }

    private async checkMetadata(conexion: Conexion, cfg: IRouteGroupCache): Promise<INetCache> {
        const metadata = await this.loadMetadata(conexion, cfg);
        if (metadata.version<1) {
            return Promise.reject("Versión de caché no soportada");
        }

        if (metadata.expires<Date.now()) {
            return Promise.reject("Caché expirada");
        }

        return metadata;
    }

    public async check(conexion: Conexion, cfg: IRouteGroupCache): Promise<number> {
        // await this.checkConexion(conexion);
        const metadata = await this.checkMetadata(conexion, cfg);
        const data = await this.loadData(conexion, cfg);
        return conexion.sendCache(metadata, data);
    }

    protected abstract loadMetadata(conexion: Conexion, cfg: IRouteGroupCache): Promise<INetCache>;
    protected abstract loadData(conexion: Conexion, cfg: IRouteGroupCache): Promise<Buffer>;
    public abstract save(conexion: Conexion, cfg: IRouteGroupCache): Promise<void>;
}

export type IRequestCache = IRequestCacheV1;

export interface IRequestCacheV1 {
    version: 1;
    expires: number;
    headers: Headers;
}

export abstract class RequestCache {
    /* STATIC */

    /* INSTANCE */
    protected constructor() {

    }

    // private async checkConexion(conexion: Conexion): Promise<void> {
    // }

    private async checkMetadata(url: string): Promise<IRequestCache> {
        const metadata = await this.loadMetadata(url);
        if (metadata.version<1) {
            return Promise.reject("Versión de caché no soportada");
        }

        if (metadata.expires<Date.now()) {
            return Promise.reject("Caché expirada");
        }

        return metadata;
    }

    public async check(url: string): Promise<RequestResponse<Buffer>> {
        const metadata = await this.checkMetadata(url);
        const data = await this.loadData(url);
        return {
            data,
            headers: metadata.headers,
            expires: new Date(metadata.expires),
        };
    }

    protected abstract loadMetadata(url: string): Promise<IRequestCacheV1>;
    protected abstract loadData(url: string): Promise<Buffer>;
    public abstract save(url: string, data: RequestResponse<Buffer>): Promise<void>;
}
