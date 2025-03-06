import type {IRouteGroupCache, NetCache} from "../../cache";
import type {Checker, IExpresion} from "../../checkers";
import type {Conexion, TMetodo} from "../../conexion";
import type {Dominio} from "../../config/dominio";
import type {IPodInfo} from "../../../utiles/config";
import {Comodin} from "../../checkers/comodin";
import {Exact} from "../../checkers/exact";
import {Prefix} from "../../checkers/prefix";
import {Regex} from "../../checkers/regex";
import {PromiseDelayed} from "../../../utiles/promise";
import {error} from "../../../utiles/log";

type THandler = (conexion: Conexion, url: string[])=>Promise<number>;

type TUpdaterHandler = (bloque: RouteGroupBlock)=>Promise<IExpresion[]>;
type TUpdater = {
    interval?: number;
    exec: TUpdaterHandler;
};

export interface IRouteGroup {
    expresiones?: IExpresion[];
    stop?: boolean;
    redireccion?: Dominio;
    handler?: THandler;
    updater?: TUpdater;
    cache?: Partial<IRouteGroupCache>;
    documentable?: boolean;
}

interface IRouteGroupFinal {
    expresiones: Checker[];
    stop: boolean;
    redireccion?: Dominio;
    handler: THandler;
    updater?: TUpdater;
    cache: IRouteGroupCache;
    documentable: boolean;
}

export class RouteGroupBlock {
    /* STATIC */
    public static build(data: IRouteGroup): RouteGroupBlock {
        data.handler ??= (conexion)=>conexion.error(404, "No se ha definido manejador");
        const nuevo = new this({
            expresiones: this.parseExpresiones(data.expresiones??[]),
            redireccion: data.redireccion,
            stop: data.stop===undefined?false:data.stop,
            handler: data.handler,
            updater: data.updater,
            cache: data.cache===undefined? {
                enabled: false,
                device: false,
            }:{
                enabled: false,
                device: false,
                ...data.cache,
            },
            documentable: data.documentable??true,
        });

        nuevo.initUpdater();

        return nuevo;
    }

    private static parseExpresiones(expresiones: IExpresion[]): Checker[] {
        const salida: Checker[] = [];
        for (let expresion of expresiones) {
            if (expresion.regex!=undefined) {
                salida.push(new Regex(expresion, expresion.regex, expresion.prefix));
            } else if (expresion.exact!=undefined) {
                salida.push(new Exact(expresion, expresion.exact));
            } else if (expresion.prefix!=undefined) {
                salida.push(new Prefix(expresion, expresion.prefix));
            } else if (expresion.comodin!=undefined) {
                salida.push(new Comodin(expresion, expresion.comodin));
            }
        }

        return salida;
    }

    /* INSTANCE */
    public ok: boolean;
    public readonly stop: boolean;

    private readonly redireccion?: Dominio;
    private readonly cache: IRouteGroupCache;
    private expresiones: Checker[];
    private readonly handler: THandler;
    private readonly prehandler: THandler;
    private updateando: boolean;
    private readonly updater?: Required<TUpdater>;
    public readonly documentable: boolean;

    private constructor(data: IRouteGroupFinal) {
        this.ok = false;
        this.stop = data.stop;

        this.redireccion = data.redireccion;
        this.cache = data.cache;
        this.expresiones = data.expresiones;
        this.handler = data.handler;
        this.prehandler = !this.cache.enabled ?
            this.handler :
            this.handlerCache;
        this.updateando = false;
        this.updater = data.updater==undefined ?
            undefined :
            {
                interval: 0,
                ...data.updater,
            };
        this.documentable = data.documentable;
    }

    public getDocumentables(): Checker[] {
        const salida: Checker[] = [];
        for (const actual of this.expresiones) {
            if (!actual.documentacion.enabled) {
                continue;
            }
            salida.push(actual);
        }

        return salida;
    }

    public setCache(cache: NetCache): void {
        this.cache.handler ??= cache;
    }

    private initUpdater(): void {
        if (this.updater!=undefined) {
            const fnc = this.updater.exec;
            this.updaterExec(fnc);
            if (this.updater.interval>0) {
                setInterval(()=>{
                    if (!this.updateando) {
                        this.updateando = true;
                        this.updaterExec(fnc);
                    }
                }, this.updater.interval);
            }
        } else {
            this.ok = true;
        }
    }

    private updaterExec(fnc: TUpdaterHandler): void {
        fnc(this).then(async (data) => {
            this.expresiones = RouteGroupBlock.parseExpresiones(data);
            this.ok = true;
            this.updateando = false;
        }).catch(async (err) => {
            error(`Error updateando HandlerBloque`, err);
            await PromiseDelayed(1000);
            this.updaterExec(fnc);
        });
    }

    private async handlerCache(conexion: Conexion, coincidencias: string[]): Promise<number> {
        if (conexion.metodo!="GET") { // la caché la dejamos solo para peticiones GET
            return this.handler(conexion, coincidencias);
        }

        if (this.cache.handler==undefined) {
            return this.handler(conexion, coincidencias);
        }

        try {
            return await this.cache.handler.check(conexion, this.cache);
        } catch (err) {
            const salida = await this.handler(conexion, coincidencias);
            PromiseDelayed()
                .then(async ()=>{
                    await this.cache.handler!.save(conexion, this.cache).catch(()=>{});
                });

            return salida;
        }
    }

    private async parseHandler(conexion: Conexion, coincidencias: string[]): Promise<void> {
        if (this.redireccion!=undefined) {
            const host = this.redireccion.getRedireccion(this.redireccion.searchHost(conexion.dominio));
            if (host!=undefined) {
                const dominio = this.redireccion.host(host);
                await conexion.send301(conexion.url.replace(conexion.dominio, dominio));
                return;
            }
        }

        const span = conexion.tracer.span("Handler");
        await this.prehandler(conexion, coincidencias)
            .catch(async (err)=>{
                error("Error en Handler.check", conexion.url, err);
                span.error(err.message);

                if (!conexion.isTerminado()) {
                    await conexion.error(500, err)
                        .catch((err)=>{
                            error("Error en Handler.check (FATAL)", conexion.url, err);
                        });
                }
            });
        span.end();
        conexion.tracer.end();
    }

    private async parseCors(conexion: Conexion, expresion: Checker): Promise<void> {
        conexion.enableCors();
        conexion.addCustomHeader("Access-Control-Allow-Credentials", "true");
        conexion.addCustomHeader("Access-Control-Allow-Methods", expresion.metodos.join(", "));
        conexion.addCustomHeader("Access-Control-Allow-Headers", "DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization,Referrer-Policy,x-api-key");
        conexion.addCustomHeader("Access-Control-Max-Age", 1728000);
        conexion.setContentType("text/plain charset=UTF-8");
        await conexion
            .sendData(null)
            .catch(async (err)=>{
                error("Error en Handler.check (OPTIONS)", conexion.url, err);
            });
    }

    public async check(pod: IPodInfo, conexion: Conexion, metodo: TMetodo): Promise<boolean> {
        for (const expresion of this.expresiones) {
            const coincidencias = expresion.check({
                metodo,
                dominio: conexion.dominio,
                url: conexion.get,
                query: conexion.query,
            });
            if (coincidencias!==null) {
                if (this.stop) {
                    return true;
                }
                conexion.preparando();

                conexion.tracer
                    .setPlantilla(expresion.resumen)
                    .setInterna(expresion.internal);

                if (conexion.metodo!="OPTIONS") {
                    await this.parseHandler(conexion, coincidencias);
                } else {
                    await this.parseCors(conexion, expresion);
                }

                return true;
            }
        }

        return false;
    }
}
