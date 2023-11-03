import {IRouteGroupCache, NetCache} from "../../cache";
import {Checker, IExpresion} from "../../checkers";
import {Comodin} from "../../checkers/comodin";
import {Conexion, TMetodo} from "../../conexion";
import {Exact} from "../../checkers/exact";
import {IPodInfo} from "../../../utiles/config";
import {Prefix} from "../../checkers/prefix";
import {Regex} from "../../checkers/regex";
import {PromiseDelayed} from "../../../utiles/promise";
import {error} from "../../../utiles/log";

type THandler = (conexion: Conexion, url: string[])=>Promise<number>;

type TUpdaterHandler = (bloque: RouteGroupBlock)=>Promise<IExpresion[]>;
type TUpdater = {
    interval: number;
    exec: TUpdaterHandler;
};

export interface IRouteGroup {
    expresiones: IExpresion[];
    stop?: boolean;
    handler: THandler;
    updater?: TUpdater;
    cache?: Partial<IRouteGroupCache>;
}

interface IRouteGroupFinal {
    expresiones: Checker[];
    stop: boolean;
    handler: THandler;
    updater?: TUpdater;
    cache: IRouteGroupCache;
}

export class RouteGroupBlock {
    /* STATIC */
    public static build(data: IRouteGroup): RouteGroupBlock {
        const nuevo = new this({
            expresiones: this.parseExpresiones(data.expresiones),
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

    private readonly cache: IRouteGroupCache;
    private expresiones: Checker[];
    private readonly handler: THandler;
    private readonly prehandler: THandler;
    private updateando: boolean;
    private readonly updater?: TUpdater;

    private constructor(data: IRouteGroupFinal) {
        this.ok = false;
        this.stop = data.stop;

        this.cache = data.cache;
        this.expresiones = data.expresiones;
        this.handler = data.handler;
        this.prehandler = !this.cache.enabled ?
            this.handler :
            this.handlerCache;
        this.updateando = false;
        this.updater = data.updater;
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
        conexion.addCustomHeader("Access-Control-Allow-Headers", "DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization,Referrer-Policy");
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
