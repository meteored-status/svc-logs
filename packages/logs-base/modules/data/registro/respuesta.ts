import {IRAWDataEdge, IRAWDataOrigin, IRAWDataResponse} from ".";

interface IHeadersMR {
    chain?:   string[];
    node?:    string;
    service?: string;
    version?: string;
    zone?:    string;
}

interface IHeaders {
    tags?: string[];
    etag?: string;
    expires?: Date;
    lastModified?: Date;
    mr?: IHeadersMR;
}

interface IHeadersES {
    tags?: string[];
    etag?: string;
    expires?: string;
    lastModified?: string;
    mr?: IHeadersMR;
}

interface IRegistroRespuestaTiemposOrigin {
    // dns: number;
    // request: number;
    lag: number;
    total: number;
}

export interface IRegistroRespuestaTiempos {
    inicio: Date;
    lag: number;
    fin: Date;
    origin?: IRegistroRespuestaTiemposOrigin;
}

export interface IRegistroRespuestaTiemposES {
    inicio: string;
    lag: number;
    fin: string;
    origin?: IRegistroRespuestaTiemposOrigin;
}

export interface IRegistroRespuesta {
    status: number;
    tiempos: IRegistroRespuestaTiempos;
    headers?: IHeaders;
}

export interface IRegistroRespuestaES {
    status: number;
    tiempos: IRegistroRespuestaTiemposES;
    headers?: IHeadersES;
}

export class RegistroRespuesta implements IRegistroRespuesta {
    /* STATIC */
    public static build(edge: IRAWDataEdge, response: IRAWDataResponse, origin?: IRAWDataOrigin): RegistroRespuesta {
        const headers: IHeaders = {};
        if (response.headers.tags!=undefined && response.headers.tags.length>0) {
            headers.tags = response.headers.tags;
        }
        if (response.headers.etag!=undefined) {
            headers.etag = response.headers.etag;
        }
        if (response.headers.expires!=undefined) {
            headers.expires = response.headers.expires;
        }
        if (response.headers.lastModified!=undefined) {
            headers.lastModified = response.headers.lastModified;
        }

        const mr: IHeadersMR = {};
        if (response.headers.mr!=undefined) {
            if (response.headers.mr.chain!=undefined && response.headers.mr.chain.length>0) {
                mr.chain = response.headers.mr.chain;
            }
            if (response.headers.mr.node!=undefined) {
                mr.node = response.headers.mr.node;
            }
            if (response.headers.mr.service!=undefined) {
                mr.service = response.headers.mr.service;
            }
            if (response.headers.mr.version!=undefined) {
                mr.version = response.headers.mr.version;
            }
            if (response.headers.mr.zone!=undefined) {
                mr.zone = response.headers.mr.zone;
            }
        }
        if (Object.keys(mr).length>0) {
            headers.mr = mr;
        }

        return new this({
            status: edge.response.status,
            tiempos: {
                inicio: edge.timestamp.start,
                lag: edge.time2FirstByte,
                fin: edge.timestamp.end,
                origin: origin ? {
                    // dns: origin.dns.response.time,
                    // request: origin.request.header.send.duration,
                    lag: origin.response.header.receive.duration,
                    total: origin.response.duration,
                }: undefined,
            },
            headers: Object.keys(headers).length>0 ?
                headers : undefined,
        });
    }

    /* INSTANCE */
    public get status(): number { return this.data.status; }
    public get tiempos(): IRegistroRespuestaTiempos { return this.data.tiempos; };
    public get headers(): IHeaders|undefined { return this.data.headers; };

    protected constructor(private data: IRegistroRespuesta) {
    }

    public toJSON(): IRegistroRespuestaES {
        let headers: IHeadersES|undefined;
        if (this.data.headers!=undefined) {
            headers = {};
            headers.tags = this.data.headers.tags;
            headers.etag = this.data.headers.etag;
            headers.expires = this.data.headers.expires?.toISOString();
            headers.lastModified = this.data.headers.lastModified?.toISOString();
            if (this.data.headers.mr!=undefined) {
                headers.mr = this.data.headers.mr;
            }
        }

        return {
            status: this.data.status,
            tiempos: {
                inicio: this.data.tiempos.inicio.toISOString(),
                lag: this.data.tiempos.lag,
                fin: this.data.tiempos.fin.toISOString(),
                origin: this.data.tiempos.origin ? {
                    // dns: this.data.tiempos.origin.dns,
                    // request: this.data.tiempos.origin.request,
                    lag: this.data.tiempos.origin.lag,
                    total: this.data.tiempos.origin.total,
                }: undefined,
            },
            headers,
        };
    }
}
