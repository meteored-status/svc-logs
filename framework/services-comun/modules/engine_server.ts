import chokidar from "chokidar";
import os from "node:os";

import {ConfiguracionNet} from "./net/config/config";
import {EngineBase} from "./engine_base";
import {Idioma, IIdiomas} from "./net/idiomas";
import {Net} from "./net/config/net";
import {NetCache} from "./net/cache";
import {NetCacheDisk} from "./net/cache/disk";
import {Respuesta} from "./net/respuesta";
import {Routes} from "./net/routes";
import {RouteGroup, RouteGroupError} from "./net/routes/group";
import {Configuracion} from "./utiles/config";
import {PromiseDelayed} from "./utiles/promise";
import {isDir, mkdir} from "./utiles/fs";
import {error, info} from "./utiles/log";
import server from "./net/server";

import Admin from "./net/handlers/admin";
import Favicon from "./net/handlers/favicon";
import Error from "./net/handlers/error";

export interface IConfig {
    error?: RouteGroupError;
    idiomas?: IIdiomas;
    cache?: NetCache;
}

export abstract class EngineServer<T extends ConfiguracionNet=ConfiguracionNet> extends EngineBase<T> {
    /* STATIC */
    protected static override async prebuild(configuracion: Configuracion): Promise<void> {
        super.prebuild(configuracion);

        if (!PRODUCCION) {
            Respuesta.SERVICE = configuracion.pod.servicio;
            Respuesta.POD = configuracion.pod.servicio;
        } else {
            const hostname = os.hostname().split("-");
            Respuesta.SERVICE = hostname.slice(0, -2).join('-');
            Respuesta.POD = hostname.slice(-2).join("-");
        }
        Respuesta.VERSION = configuracion.pod.version;
        Respuesta.ZONA = configuracion.pod.zona;
    }

    /* INSTANCE */
    private handlers: RouteGroup[];
    public routes?: Routes;

    protected constructor(configuracion: T, inicio: number) {
        super(configuracion, inicio);

        this.handlers = [];
    }

    protected override init(): void {
        PromiseDelayed().then(async () => {
            if (!await isDir("files/tmp")) {
                return;
            }
            await mkdir("files/tmp/admin/", true);
            const watcher = chokidar.watch("files/tmp/admin/", {
                persistent: true,
            });
            watcher.on("add", (path) => {
                const fileName = path.split('/').pop();

                if (fileName === "shutdown.lock") {
                    // info("Se ha solicitado el apagado del POD");
                    this.abort("Se ha solicitado el apagado del POD");
                    this.shutdown().then(()=>{}).catch(()=>{});
                }
            });
        }).catch(() => {
            // Handle error here
        });
    }

    private iniciar(handlers: RouteGroup[], config: IConfig): void {
        if (config.idiomas!=undefined) {
            Idioma.inicializar(config.idiomas);
        }

        handlers.push(Admin(this.configuracion, this));
        handlers.push(Favicon(this.configuracion));

        config.cache ??= new NetCacheDisk();
        for (const actual of handlers) {
            actual.setCache(config.cache);
        }

        this.handlers = handlers;
    }

    protected initWebServer(handlers: RouteGroup[], net: Net, config: IConfig = {}): void {
        info("Iniciando Servidor Web");

        this.iniciar(handlers, config);
        this.routes ??= new Routes(handlers, config.error??Error(this.configuracion));

        server.iniciarHTTP(this.routes, this.configuracion.pod, net);
    }

    protected initWebServerS(handlers: RouteGroup[], net: Net, config: IConfig = {}): void {
        info("Iniciando Servidor Web Seguro");

        this.iniciar(handlers, config);
        this.routes ??= new Routes(handlers, config.error??Error(this.configuracion));

        server.iniciarHTTPs(this.routes, this.configuracion.pod, net)
            .then(() => {}).catch((err) => {
                error("Error iniciando HTTPs", err);
        });
    }

    public async started(): Promise<void> {
        return this.ok();
    }

    public async ready(): Promise<void> {
        return this.ok();
    }

    public async okAll(): Promise<void> {
        for (const actual of this.handlers) {
            if (!actual.ok) {
                return Promise.reject("Handler no preparado");
            }
        }
        await this.ok();
    }

    protected async ok(): Promise<void> {

    }

    protected async shutdown(): Promise<void> {
    }
}
