/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 10:42:05 GMT
 * Hash: c9b68f4f40d16c38cdb5b339e4e6467f
 * Versión: 2026.5.18+2-josantoniojimnez
 */

import chokidar from "chokidar";
import os from "node:os";

import {ConfiguracionNet} from "@mr/core-network/server/http/config/config";
import {Idioma, IIdiomas} from "@mr/core-network/server/http/i18n";
import type {IWSHandler} from "@mr/core-network/server/websocket/handler";
import {Net} from "@mr/core-network/server/http/config/net";
import {Respuesta} from "@mr/core-network/server/http/respuesta";
import {Routes} from "@mr/core-network/server/http/routes";
import {RouteGroup, RouteGroupError} from "@mr/core-network/server/http/routes/group";
import server from "@mr/core-network/server/http/server";
import webSocket from "@mr/core-network/server/websocket";

import {EngineBase} from "./engine_base";
import {NetCache} from "./net/cache";
import {NetCacheDisk} from "./net/cache/disk";
import {Configuracion} from "./utiles/config";
import {PromiseDelayed} from "./utiles/promise";
import {isDir, mkdir} from "./utiles/fs";
import {error, info} from "./utiles/log";

import Admin from "@mr/core-network/server/http/handlers/admin";
import Favicon from "@mr/core-network/server/http/handlers/favicon";
import Error from "@mr/core-network/server/http/handlers/error";

export interface IConfig {
    error?: RouteGroupError;
    idiomas?: IIdiomas;
    cache?: NetCache;
}

export abstract class EngineServer<T extends ConfiguracionNet=ConfiguracionNet> extends EngineBase<T> {
    /* STATIC */
    protected static override async prebuild(configuracion: Configuracion): Promise<void> {
        await super.prebuild(configuracion);

        let service: string;
        let pod: string;
        if (!PRODUCCION) {
            service = configuracion.pod.servicio;
            pod = configuracion.pod.servicio;
        } else {
            const hostname = os.hostname().split("-");
            service = hostname.slice(0, -2).join('-');
            pod = hostname.slice(-2).join("-");
        }
        Respuesta.setContextoDefecto({
            service,
            pod,
            version: configuracion.pod.version,
            zona: configuracion.pod.zona,
        });
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

    private iniciar(handlers: RouteGroup[], config: IConfig): IWSHandler[] {
        const webSockets: IWSHandler[] = [];

        if (config.idiomas!=undefined) {
            Idioma.inicializar(config.idiomas);
        }

        handlers.push(Admin(this.configuracion, this));
        handlers.push(Favicon(this.configuracion));
        webSockets.push()

        config.cache ??= new NetCacheDisk();
        for (const actual of handlers) {
            actual.setCache(config.cache);
            webSockets.push(...actual.getWSHandlers());
        }

        this.handlers = handlers;

        return webSockets;
    }

    protected initWebServer(handlers: RouteGroup[], net: Net, config: IConfig = {}): void {
        info("Iniciando Servidor Web");

        const ws = this.iniciar(handlers, config);
        this.routes ??= new Routes(handlers, config.error??Error(this.configuracion));

        const http = server.iniciarHTTP(this.routes, net);
        if (ws.length>0) {
            info("Iniciando Web Socket");
            const socket = webSocket(http, ws);
        }
    }

    protected initWebServerS(handlers: RouteGroup[], net: Net, config: IConfig = {}): void {
        info("Iniciando Servidor Web Seguro");

        const ws = this.iniciar(handlers, config);
        this.routes ??= new Routes(handlers, config.error??Error(this.configuracion));

        server.iniciarHTTPs(this.routes, net)
            .then((http) => {
                if (ws.length>0) {
                    info("Iniciando Web Socket Seguro");
                    const socket = webSocket(http, ws);
                }
            })
            .catch((err) => {
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
