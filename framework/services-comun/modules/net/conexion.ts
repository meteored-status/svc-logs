import querystring from "node:querystring";
import {Files} from "formidable";
import {IncomingHttpHeaders, IncomingMessage, ServerResponse} from "node:http";
import {URL, URLSearchParams} from "node:url";
import {parse} from "qs";

import type {Net} from "./config/net";
import type {Tracer} from "./tracer";
import {ErrorCode, IErrorInfo, IOK, IRespuestaKO, IRespuestaOK} from "./interface";
import {Idioma} from "./idiomas";
import {IErrorHandler} from "./router";
import {IPodInfo} from "../utiles/config";
import {Respuesta} from "./respuesta";

export type TMetodo = "ALL"|"GET"|"POST"|"PUT"|"DELETE"|"HEAD"|"OPTIONS"|"PATCH";

enum TStatus {
    iniciando,
    iniciado,
    preparando,
    transfiriendo,
    terminado,
}

export enum TDevice {
    unknown,
    desktop,
    mobile,
    tablet,
    amp,
}

export class Conexion extends Respuesta {
    /* STATIC */
    public static buildRespuesta<T=undefined>({expiracion, data}: Partial<IOK<T>> = {}): IRespuestaOK<T|undefined> {
        if (expiracion==undefined) {
            expiracion = new Date();
        }

        return {
            ok: true,
            expiracion: expiracion.getTime(),
            data,
        };
    }

    public static buildError(data?: Partial<IErrorInfo>): IRespuestaKO {
        return {
            ok: false,
            expiracion: new Date().getTime(),
            info: {
                code: ErrorCode.APPLICATION,
                message: "Error interno",
                ...data??{},
            },
        };
    }

    /**
     * @deprecated
     */
    public static baseDefecto<T=undefined>(expiracion?: Date, data?: T): IRespuestaOK<T|undefined> {
        // deprecated => usar la implementación de Group (this.sendRespuesta(conexion);)
        return {
            ok: true,
            expiracion: (expiracion??new Date()).getTime(),
            data,
        };
    }

    /**
     * @deprecated
     */
    public static baseError(data?: Partial<IErrorInfo>): IRespuestaKO {
        // deprecated => usar la implementación de Group (this.sendError(conexion);)
        return {
            ok: false,
            expiracion: new Date().getTime(),
            info: {
                code: ErrorCode.APPLICATION,
                message: "Error interno",
                ...data??{},
            },
        };
    }

    /* INSTANCE */
    public readonly path: string;
    public readonly get: string;
    public post?: NodeJS.Dict<any>;
    public postRAW?: string;
    public files?: Files;
    private cors: boolean;
    public dominio: string;
    public start: Date;
    public idioma: Idioma;

    public get metodo(): TMetodo {
        return (this.peticion.method as TMetodo|undefined)??"GET";
    }

    public get accept(): string {
        return this.peticion.headers["accept"]??"";
    }

    public get userAgent(): string {
        return this.peticion.headers["user-agent"]??"";
    }

    public get ifModifiedSince(): Date|null { // last-modified de la peticón anterior
        const last = this.peticion.headers["if-modified-since"];
        if (last==undefined) {
            return null;
        }
        return new Date(last);
    }

    public get ifNoneMatch(): string|null { // etag de la peticón anterior
        return this.peticion.headers["if-none-match"]??null;
    }

    public get url(): string {
        return `${!this.https?"http":"https"}://${this.peticion.headers.host}${this.peticion.url}`;
    }

    public get ip(): string {
        return this.peticion.connection.remoteAddress??"0.0.0.0";
    }

    private _device?: TDevice;
    public get device(): TDevice {
        return this._device??=this.detectarDevice();
    }

    private status:TStatus;
    public readonly query: URLSearchParams;
    public readonly queryRAW: string;

    public constructor(private readonly peticion: IncomingMessage, respuesta: ServerResponse, errorHandler: IErrorHandler, tracer: Tracer, pod: IPodInfo, config: Net, public readonly https: boolean) {
        super(respuesta, errorHandler, tracer, pod, config);

        this.start = new Date();
        const url = new URL(`http://localhost${peticion.url??"/"}`);
        // const componentes = url.parse(peticion.url as string, true);
        this.idioma = Idioma.build(url.pathname);
        // this.get = querystring.unescape(url.pathname);
        this.get = querystring.unescape(this.idioma.path);
        this.post = {};
        this.files = {};
        this.cors = this.get.indexOf("/web")==0;
        this.status = TStatus.iniciando;
        this.query = url.searchParams;
        this.queryRAW = url.search;
        this.dominio = peticion.headers.host??"";
        this.path = url.pathname;
    }

    private detectarDevice(): TDevice {
        if (this.get.endsWith("_amp.html") || this.get.endsWith("-amp.html")) {
            return TDevice.amp;
        }
        const cf = this.getHeaders()["cf-device-type"];
        if (cf!=undefined) {
            switch(cf) {
                case "mobile":
                    return TDevice.mobile;
                case "tablet":
                    return TDevice.tablet;
            }
            return TDevice.desktop;
        }

        const ua = this.userAgent;
        if (/(?:phone|windows\s+phone|ipod|blackberry|(?:android|bb\d+|meego|silk|googlebot) .+? mobile|palm|windows\s+ce|opera\ mini|avantgo|mobilesafari|docomo)/i.exec(ua)!=null) {
            return TDevice.mobile;
        }
        if (/(?:ipad|playbook|(?:android|bb\d+|meego|silk)(?! .+? mobile))/i.exec(ua)!=null) {
            return TDevice.tablet;
        }
        return TDevice.desktop;
    }

    public getPeticion(): IncomingMessage {
        return this.peticion;
    }

    public enableCors(): Conexion {
        this.cors = true;
        return this;
    }

    public disableCors(): Conexion {
        this.cors = false;
        return this;
    }

    protected isCORS(): boolean {
        return this.cors;
    }


    public iniciado(): void {
        if (this.status==TStatus.iniciando) {
            this.status = TStatus.iniciado;
        }
    }

    public preparando(): void {
        if (this.status==TStatus.iniciado) {
            this.status = TStatus.preparando;
        }
    }

    public transfiriendo(): void {
        if (this.status==TStatus.preparando) {
            this.status = TStatus.transfiriendo;
        }
    }

    public terminado(): void {
        if (this.status==TStatus.transfiriendo) {
            this.status = TStatus.terminado;
        }
    }

    public isTerminado(): boolean {
        return this.status>=TStatus.transfiriendo;
    }

    public getHeaders(): IncomingHttpHeaders {
        return this.peticion.headers;
    }

    public getQuery<T=any>(): T {
        return parse(this.queryRAW, { ignoreQueryPrefix: true }) as T;
    }

    // public getQuery<T>(): T {
    //     const salida: any = {};
    //     for (const key of this.query.keys()) {
    //         const values = this.query.getAll(key);
    //         if (values.length==1) {
    //             salida[key] = values[0];
    //         } else {
    //             salida[key] = values;
    //         }
    //     }
    //     return salida as T;
    // }
}
