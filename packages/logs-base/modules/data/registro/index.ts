import {hostname} from "node:os";

import {RegistroCache, type IRegistroCache} from "./cache";
import {RegistroCliente, type IRegistroCliente} from "./cliente";
import {RegistroExtremo, type IRegistroExtremo} from "./extremo";
import {RegistroOrigen, type IRegistroOrigen} from "./origen";
import {RegistroPeticion, type IRegistroPeticion} from "./peticion";
import {RegistroRespuesta, type IRegistroRespuesta, type IRegistroRespuestaES} from "./respuesta";

export interface IRAWDataClient {
    asn: number;
    country: string;
    device: {
        type: string;
    };
    ip: {
        value: string;
        class: string;
    };
    mtls?: {
        auth: {
            cert: {
                fingerprint: string;
            };
            status: string;
        };
    };
    region?: string;
    request: {
        bytes: number;
        host: string;
        method: string;
        path: string;
        protocol: string;
        referer?: string;
        scheme: string;
        source: string;
        ua?: string;
        uri: string;
    },
    ssl?: {
        cipher: string;
        protocol: string;
        version: string;
    };
    src?: {
        port: number;
    };
    tcp?: {
        rtt?: number;
    };
    x?: {
        requestedWith: string;
    };
}

export interface IRAWDataEdge {
    cf: {
        connectingO2O: boolean;
    };
    colo: {
        code: string;
        id: number;
    };
    pathing: {
        op: string;
        src: string;
        status: string;
    };
    rateLimit?: {
        action: string;
        id: number;
    };
    request: {
        host: string;
    };
    response: {
        body: {
            bytes: number;
        };
        bytes: number;
        compression: {
            ratio: number;
        };
        contentType: string;
        status: number;
    };
    ray: string;
    server?: {
        ip: string;
    },
    time2FirstByte: number;
    timestamp: {
        start: Date;
        end: Date;
    };
}

export interface IRAWDataOrigin {
    dns: {
        response: {
            time: number;
        };
    };
    ip: string;
    request: {
        header: {
            send: {
                duration: number;
            };
        };
    };
    response: {
        bytes: number;
        duration: number;
        header: {
            receive: {
                duration: number;
            };
        };
        http: {
            expires: string;
            lastModified: string;
        };
        status: number;
        time: number;
    };
    ssl: {
        protocol: string;
    };
    tcp: {
        handshake: {
            duration: number;
        };
    };
    tls: {
        handshake: {
            duration: number;
        };
    };
}

export interface IRAWDataCache {
    reserve: {
        used: boolean;
    };
    response: {
        bytes: number;
        status: number;
    };
    status: string;
    tiered: {
        fill: boolean;
    };
}

export interface IRAWDataRequest {
    headers: {
        apiKey?: string;
    };
}

export interface IRAWDataResponse {
    headers: {
        tags?: string[];
        etag?: string;
        expires?: Date;
        lastModified?: Date;
        mr: {
            chain?:   string[];
            node?:    string;
            service?: string;
            version?: string;
            zone?:    string;
        };
    };
}

export interface IRAWData {
    client: IRAWDataClient;
    edge: IRAWDataEdge;
    cache: IRAWDataCache;
    cookies: {
        user?: string;
    };
    content?: {
        scan: {
            results?: string[];
            types?: string[];
        };
    };
    firewall?: {
        matches: {
            actions?: any[];
            ruleIDs?: any[];
            sources?: any[];
        };
    };
    origin?: IRAWDataOrigin;
    parent: {
        ray: string;
    };
    request: IRAWDataRequest;
    response: IRAWDataResponse;
    security?: {
        action: string;
        actions?: string[];
        level: string;
        rule: {
            description?: string;
            id?: string;
            ids?: string[];
        };
        sources?: string[];
    };
    smart?: {
        route: {
            colo: number;
        };
    };
    upper?: {
        tier: {
            colo: number;
        };
    };
    waf?: {
        action: string;
        flags: string;
        matched: {
            var: string;
        };
        profile: string;
        rce: {
            score?: number;
        };
        rule: {
            id: string;
            message: string;
        };
        score?: number;
        sqli: {
            score?: number;
        };
        xss: {
            score?: number;
        };
    };
    worker?: {
        cpu: {
            time: number;
        };
        status: string;
        subrequest: {
            count: number;
        };
        wall: {
            time: number;
        };
    };
    zone: {
        id?: number;
        name: string;
    };
}

interface IRegistro {
    timestamp: Date;
    url: URL;
    peticion: IRegistroPeticion;
    cache: IRegistroCache;
    respuesta: IRegistroRespuesta;
    cliente: IRegistroCliente;
    extremo: IRegistroExtremo;
    origen?: IRegistroOrigen;
}

interface IRegistroES {
    "@timestamp": string;
    url: string;
    peticion: IRegistroPeticion;
    cache: IRegistroCache;
    respuesta: IRegistroRespuestaES;
    cliente: IRegistroCliente;
    extremo: IRegistroExtremo;
    origen?: IRegistroOrigen;
}

interface IObj {
    peticion: RegistroPeticion;
    cache: RegistroCache;
    respuesta: RegistroRespuesta;
    cliente: RegistroCliente;
    extremo: RegistroExtremo;
    origen?: RegistroOrigen;
}

export class Registro implements IRegistro {
    /* STATIC */

    public static build(data: IRAWData): Registro {
        const peticion = RegistroPeticion.build(data.client, data.request, data.zone.name);
        const cache = RegistroCache.build(data.cache);
        const respuesta = RegistroRespuesta.build(data.edge, data.response, data.origin);
        const cliente = RegistroCliente.build(data.client);
        const extremo = RegistroExtremo.build(data.edge);
        const origen = RegistroOrigen.build(data.origin);
        const url = new URL(`${data.client.request.scheme}://${data.client.request.host}${data.client.request.uri}`);

        return new this({
            timestamp: data.edge.timestamp.start,
            url,
            peticion,
            cache,
            respuesta,
            cliente,
            extremo,
            origen,
        }, {
            peticion,
            cache,
            respuesta,
            cliente,
            extremo,
            origen,
        });
    }

    /* INSTANCE */
    public get timestamp(): Date { return this.data.timestamp; }
    public get url(): URL { return this.data.url; }
    public get peticion(): RegistroPeticion { return this.obj.peticion; }
    public get cache(): RegistroCache { return this.obj.cache; }
    public get respuesta(): RegistroRespuesta { return this.obj.respuesta; }
    public get cliente(): RegistroCliente { return this.obj.cliente; }
    public get extremo(): RegistroExtremo { return this.obj.extremo; }
    public get origen(): RegistroOrigen|undefined { return this.obj.origen; }

    public constructor(private readonly data: IRegistro, private readonly obj: IObj) {
    }

    public toJSON(): IRegistroES {
        return {
            "@timestamp": this.data.timestamp.toISOString(),
            url: this.data.url.toString(),
            peticion: this.obj.peticion.toJSON(),
            cache: this.obj.cache.toJSON(),
            respuesta: this.obj.respuesta.toJSON(),
            cliente: this.obj.cliente.toJSON(),
            extremo: this.obj.extremo.toJSON(),
            origen: this.obj.origen?.toJSON(),
        };
    }
}
