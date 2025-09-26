import type {IRAWDataClient, IRAWDataRequest} from ".";

interface ISSL {
    name?: string;
    version?: string;
}

interface IHeaders {
    apiKey?: string;
}

export interface IRegistroPeticion {
    method: string;
    scheme: string;
    dominio: string;
    subdominio: string;
    path: string;
    uri: string;
    protocol: string;
    ssl?: ISSL;
    bytes?: number;
    referer?: string;
    source?: string;
    headers?: IHeaders;
}

export class RegistroPeticion implements IRegistroPeticion {
    /* STATIC */
    public static build(client: IRAWDataClient, request: IRAWDataRequest): RegistroPeticion {
        const headers: IHeaders = {};
        if (request.headers.apiKey!=undefined) {
            headers.apiKey = request.headers.apiKey;
        }

        return new this({
            method: client.request.method,
            scheme: client.request.scheme,
            dominio: client.request.host,
            subdominio: client.request.host,//.substring(0, client.request.host.length - zona.length - 1),
            path: client.request.path,
            uri: client.request.uri,
            protocol: client.request.protocol,
            ssl: client.ssl!=undefined ?
                {name: client.ssl?.protocol, version: client.ssl?.version} : undefined,
            bytes: client.request.bytes,
            referer: client.request.referer,
            source: client.request.source,
            headers: Object.keys(headers).length>0 ?
                headers : undefined,
        });
    }

    /* INSTANCE */
    public get method(): string { return this.data.method; }
    public get scheme(): string { return this.data.scheme; }
    public get dominio(): string { return this.data.dominio; }
    public get subdominio(): string { return this.data.subdominio; }
    public get path(): string { return this.data.path; }
    public get uri(): string { return this.data.uri; }
    public get protocol(): string { return this.data.protocol; }
    public get ssl(): ISSL|undefined { return this.data.ssl; }
    public get bytes(): number|undefined { return this.data.bytes; }
    public get referer(): string|undefined { return this.data.referer; }
    public get source(): string|undefined { return this.data.source; }
    public get headers(): IHeaders|undefined { return this.data.headers; }

    protected constructor(private data: IRegistroPeticion) {
    }

    public toJSON(): IRegistroPeticion {
        return {
            method: this.data.method,
            scheme: this.data.scheme,
            dominio: this.data.dominio,
            subdominio: this.data.subdominio,
            path: this.data.path,
            uri: this.data.uri,
            protocol: this.data.protocol,
            ssl: this.data.ssl,
            bytes: this.data.bytes,
            referer: this.data.referer,
            source: this.data.source,
            headers: this.data.headers,
        };
    }
}
