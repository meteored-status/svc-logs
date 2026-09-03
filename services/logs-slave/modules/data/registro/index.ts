import {RegistroCache, type IRegistroCache, type IRegistroCacheApp} from "./cache";
import {RegistroCliente, type IRegistroCliente, type IRegistroClienteCrawler, type IRegistroClienteApp} from "./cliente";
import {RegistroOrigen, type IRegistroOrigen} from "./origen";
import {RegistroPeticion, type IRegistroPeticion, type IRegistroPeticionApp} from "./peticion";
import {RegistroRespuesta, type IRegistroRespuesta} from "./respuesta";

import type {Cliente} from "../cliente";

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
    peticion: RegistroPeticion;
    cache: RegistroCache;
    respuesta: RegistroRespuesta;
    cliente: RegistroCliente;
    origen?: RegistroOrigen;
}

export interface IRegistroES {
    timestamp: string;
    url: string;
    proyecto: string;
    subproyecto?: string;
    peticion: IRegistroPeticion;
    cache: IRegistroCache;
    respuesta: IRegistroRespuesta;
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
    respuesta: IRegistroRespuesta;
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
        ambient?: string;
    };
    os: {
        nombre: string;
        version: string;
    };
    peticion: IRegistroPeticionApp;
    cache: IRegistroCacheApp;
    respuesta: IRegistroRespuesta;
    cliente: IRegistroClienteApp;
    origen?: IRegistroOrigen;
}

/**
 * Valor usado para los campos de app cuando la petición no trae el header `meteored` y se
 * reconoce como app por una de las heurísticas legacy de path.
 */
const APP_DESCONOCIDA = "unknown";

/**
 * Header `meteored`: `<so> <versión so>; <versión>/<paquete>[(sufijo)][;bg|fg]`.
 */
const APP_HEADER = /^(\w+) ([\w.]+); ?([\w./]+)\/([^/^();]+)(?:\((\w+)\))?(?:;(bg|fg)?)?$/;

export class Registro implements IRegistro {
    /* STATIC */
    public static build(data: IRAWData, cliente: Cliente): Registro {
        const respuesta = RegistroRespuesta.build(data.edge, data.response, data.origin);

        return new this({
            timestamp: data.edge.timestamp.start,
            url: new URL(`${data.client.request.scheme}://${data.client.request.host}${data.client.request.uri}`),
            proyecto: cliente.id,
            subproyecto: cliente.proyecto(respuesta.headers?.service),
            peticion: RegistroPeticion.build(data.client, data.request, data.zone.name),
            cache: RegistroCache.build(data.cache),
            respuesta,
            cliente: RegistroCliente.build(data.client),
            origen: RegistroOrigen.build(data.origin, cliente.backends),
        });
    }

    /* INSTANCE */
    public get timestamp(): Date { return this.data.timestamp; }
    public get url(): URL { return this.data.url; }
    public get proyecto(): string { return this.data.proyecto; }
    public get subproyecto(): string|undefined { return this.data.subproyecto; }
    public get peticion(): RegistroPeticion { return this.data.peticion; }
    public get cache(): RegistroCache { return this.data.cache; }
    public get respuesta(): RegistroRespuesta { return this.data.respuesta; }
    public get cliente(): RegistroCliente { return this.data.cliente; }
    public get origen(): RegistroOrigen|undefined { return this.data.origen; }

    private constructor(private readonly data: IRegistro) {
    }

    public toJSON(): IRegistroES {
        return {
            timestamp: this.data.timestamp.toISOString(),
            url: this.data.url.toString(),
            proyecto: this.data.proyecto,
            subproyecto: this.data.subproyecto,
            peticion: this.data.peticion.toJSON(),
            cache: this.data.cache.toJSON(),
            respuesta: this.data.respuesta.toJSON(),
            cliente: this.data.cliente.toJSON(),
            origen: this.data.origen?.toJSON(),
        };
    }

    public toCrawler(): IRegistroCrawler {
        return {
            timestamp: this.data.timestamp.toISOString(),
            url: this.data.url.toString(),
            proyecto: this.data.proyecto,
            subproyecto: this.data.subproyecto,
            peticion: this.data.peticion.toJSON(),
            cache: this.data.cache.toJSON(),
            respuesta: this.data.respuesta.toJSON(),
            cliente: this.data.cliente.toCrawler(),
            origen: this.data.origen?.toJSON(),
        };
    }

    public toApp(header?: string): IRegistroApp {
        const partes = header ? APP_HEADER.exec(header) : null;
        if (header && partes===null) {
            throw new Error(`Header de App inválido: ${header}`);
        }

        const [
            ,
            os = APP_DESCONOCIDA,
            osver = APP_DESCONOCIDA,
            version = APP_DESCONOCIDA,
            app = APP_DESCONOCIDA,
            sufijo,
            ambient,
        ] = partes ?? [];

        const sf = sufijo?.trim() ?? "";
        const amb = ambient?.trim() ?? "";

        const servicio = os===APP_DESCONOCIDA && this.data.peticion.path.includes("peticionMovil.php") ?
            "legacy" :
            (this.data.subproyecto ?? APP_DESCONOCIDA);

        return {
            timestamp: this.data.timestamp.toISOString(),
            url: this.data.url.toString(),
            sistema: os.trim(),
            servicio,
            tipo: undefined,
            app: {
                package: app.trim(),
                version: version.trim(),
                sufijo: sf.length>0 ? sf : undefined,
                ambient: amb.length>0 ? amb : undefined,
            },
            os: {
                nombre: os.trim(),
                version: osver.trim(),
            },
            peticion: this.data.peticion.toAPP(),
            cache: this.data.cache.toAPP(),
            respuesta: this.data.respuesta.toJSON(),
            cliente: this.data.cliente.toAPP(),
            origen: this.data.origen?.toJSON(),
        };
    }
}
