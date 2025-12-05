import type {IRAWDataEdge, IRAWDataOrigin, IRAWDataResponse} from ".";

interface IHeaders {
    node?:    string;
    service?: string;
    version?: string;
}

interface IHeadersES {
    node?:    string;
    service?: string;
    version?: string;
}

export interface IRegistroRespuesta {
    status: number;
    tiempo?: number;
    contentType: string;
    headers?: IHeaders;
}

export interface IRegistroRespuestaES {
    status: number;
    tiempo?: number;
    contentType: string;
    headers?: IHeadersES;
}

export class RegistroRespuesta implements IRegistroRespuesta {
    /* STATIC */
    public static build(edge: IRAWDataEdge, response: IRAWDataResponse, origin?: IRAWDataOrigin): RegistroRespuesta {
        const headers: IHeaders = {};
        if (response.headers!=undefined) {
            if (response.headers.node!=undefined) {
                headers.node = response.headers.node;
            }
            if (response.headers.service!=undefined) {
                headers.service = response.headers.service;
            }
            if (response.headers.version!=undefined) {
                headers.version = response.headers.version;
            }
        }

        return new this({
            status: edge.response.status,
            tiempo: origin?.response.duration,
            contentType: edge.response.contentType,
            headers: Object.keys(headers).length>0 ?
                headers : undefined,
        });
    }

    /* INSTANCE */
    public get status(): number { return this.data.status; }
    public get tiempo(): number|undefined { return this.data.tiempo; };
    public get contentType(): string { return this.data.contentType; }
    public get headers(): IHeaders|undefined { return this.data.headers; };

    protected constructor(private data: IRegistroRespuesta) {
    }

    public toJSON(): IRegistroRespuestaES {
        return {
            status: this.data.status,
            tiempo: this.data.tiempo,
            contentType: this.data.contentType,
            headers: this.data.headers,
        };
    }
}
