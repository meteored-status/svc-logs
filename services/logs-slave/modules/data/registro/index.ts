import {RegistroCache, type IRegistroCache, IRegistroCacheApp} from "./cache";
import {RegistroCliente, type IRegistroCliente, IRegistroClienteCrawler, IRegistroClienteApp} from "./cliente";
import {RegistroOrigen, type IRegistroOrigen} from "./origen";
import {RegistroPeticion, type IRegistroPeticion, IRegistroPeticionApp} from "./peticion";
import {RegistroRespuesta, type IRegistroRespuesta, type IRegistroRespuestaES} from "./respuesta";
import {Cliente} from "../cliente";

export interface IRAWDataClient {
    bot: boolean;
    country: string;
    device: {
        type: string;
    };
    ip: {
        value: string;
        class: string;
    };
    region?: string;
    request: {
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
}

export interface IRAWDataEdge {
    request: {
        host: string;
    };
    response: {
        contentType: string;
        status: number;
    };
    timestamp: {
        start: Date;
    };
}

export interface IRAWDataOrigin {
    ip: string;
    response: {
        duration: number;
    };
}

export interface IRAWDataCache {
    reserve: {
        used: boolean;
    };
    status: string;
    tiered: {
        fill: boolean;
    };
}

export interface IRAWDataRequest {
    headers: {
        apiKey?: string;
        app?: string;
    };
}

export interface IRAWDataResponse {
    headers: {
        node?:    string;
        service?: string;
        version?: string;
    };
}

export interface IRAWData {
    client: IRAWDataClient;
    edge: IRAWDataEdge;
    cache: IRAWDataCache;
    cookies: {
        mrid?: string;
        user?: string;
    };
    origin?: IRAWDataOrigin;
    request: IRAWDataRequest;
    response: IRAWDataResponse;
    zone: {
        name: string;
    };
}

interface IRegistro {
    timestamp: Date;
    url: URL;
    proyecto: string;
    subproyecto?: string;
    peticion: IRegistroPeticion;
    cache: IRegistroCache;
    respuesta: IRegistroRespuesta;
    cliente: IRegistroCliente;
    origen?: IRegistroOrigen;
}

export interface IRegistroES {
    timestamp: string;
    url: string;
    proyecto: string;
    subproyecto?: string;
    peticion: IRegistroPeticion;
    cache: IRegistroCache;
    respuesta: IRegistroRespuestaES;
    cliente: IRegistroCliente;
    origen?: IRegistroOrigen;
}

export interface IRegistroCrawler {
    timestamp: string;
    url: string;
    proyecto: string;
    subproyecto?: string;
    peticion: IRegistroPeticion;
    cache: IRegistroCache;
    respuesta: IRegistroRespuestaES;
    cliente: IRegistroClienteCrawler;
    origen?: IRegistroOrigen;
}

export interface IRegistroApp {
    timestamp: string;
    url: string;
    sistema: string;
    servicio: string;
    tipo?: string;
    app: {
        package: string;
        version: string;
        sufijo?: string;
    };
    os: {
        nombre: string;
        version: string;
    };
    peticion: IRegistroPeticionApp;
    cache: IRegistroCacheApp;
    respuesta: IRegistroRespuestaES;
    cliente: IRegistroClienteApp;
    origen?: IRegistroOrigen;
}

interface IObj {
    peticion: RegistroPeticion;
    cache: RegistroCache;
    respuesta: RegistroRespuesta;
    cliente: RegistroCliente;
    origen?: RegistroOrigen;
}

export class Registro implements IRegistro {
    /* STATIC */
    public static build(data: IRAWData, cliente: Cliente): Registro {
        const url = new URL(`${data.client.request.scheme}://${data.client.request.host}${data.client.request.uri}`);
        const peticion = RegistroPeticion.build(data.client, data.request, data.zone.name);
        const cache = RegistroCache.build(data.cache);
        const respuesta = RegistroRespuesta.build(data.edge, data.response, data.origin);
        const clienteData = RegistroCliente.build(data.client);
        const origen = RegistroOrigen.build(data.origin, cliente.backends);

        return new this({
            timestamp: data.edge.timestamp.start,
            url,
            proyecto: cliente.id,
            subproyecto: cliente.proyecto(respuesta.headers?.service),
            peticion,
            cache,
            respuesta,
            cliente: clienteData,
            origen,
        }, {
            peticion,
            cache,
            respuesta,
            cliente: clienteData,
            origen,
        });
    }

    /* INSTANCE */
    public get timestamp(): Date { return this.data.timestamp; }
    public get url(): URL { return this.data.url; }
    public get proyecto(): string { return this.data.proyecto; }
    public get subproyecto(): string|undefined { return this.data.subproyecto; }
    public get peticion(): RegistroPeticion { return this.obj.peticion; }
    public get cache(): RegistroCache { return this.obj.cache; }
    public get respuesta(): RegistroRespuesta { return this.obj.respuesta; }
    public get cliente(): RegistroCliente { return this.obj.cliente; }
    public get origen(): RegistroOrigen|undefined { return this.obj.origen; }

    public constructor(private readonly data: IRegistro, private readonly obj: IObj) {
    }

    public toJSON(): IRegistroES {
        return {
            timestamp: this.data.timestamp.toISOString(),
            url: this.data.url.toString(),
            proyecto: this.data.proyecto,
            subproyecto: this.data.subproyecto,
            peticion: this.obj.peticion.toJSON(),
            cache: this.obj.cache.toJSON(),
            respuesta: this.obj.respuesta.toJSON(),
            cliente: this.obj.cliente.toJSON(),
            origen: this.obj.origen?.toJSON(),
        };
    }

    public toCrawler(): IRegistroCrawler {
        return {
            timestamp: this.data.timestamp.toISOString(),
            url: this.data.url.toString(),
            proyecto: this.data.proyecto,
            subproyecto: this.data.subproyecto,
            peticion: this.obj.peticion.toJSON(),
            cache: this.obj.cache.toJSON(),
            respuesta: this.obj.respuesta.toJSON(),
            cliente: this.obj.cliente.toCrawler(),
            origen: this.obj.origen?.toJSON(),
        };
    }

    public toApp(header: string): IRegistroApp {
        const partes = /^(\w+) ([\w.]+); ?([\w./]+)\/([^/^(^)]+)(?:\((\w+)\))?;?$/.exec(header);
        if (!partes) {
            throw new Error(`Header de App inválido: ${header}`);
        }
        const [, os, osver, version, app, sufijo] = partes;

        return {
            timestamp: this.data.timestamp.toISOString(),
            url: this.data.url.toString(),
            sistema: os.trim(),
            servicio: this.data.subproyecto ?? "unknown",
            tipo: undefined,
            app: {
                package: app.trim(),
                version: version.trim(),
                sufijo: sufijo?.trim(),
            },
            os: {
                nombre: os.trim(),
                version: osver.trim(),
            },
            peticion: this.obj.peticion.toAPP(),
            cache: this.obj.cache.toAPP(),
            respuesta: this.obj.respuesta.toJSON(),
            cliente: this.obj.cliente.toAPP(),
            origen: this.obj.origen?.toJSON(),
        };
    }
}
