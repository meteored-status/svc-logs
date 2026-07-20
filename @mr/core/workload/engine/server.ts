/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: 5c41bd9fd1f66d9b869b0cea7f510d06
 * Versión: 2026.6.17+1-josantoniojimnez
 */

import chokidar from "chokidar";
import os from "node:os";

import type {NetCache} from "services-comun/modules/net/cache";
import {Idioma, type IIdiomas} from "@mr/core-network/server/http/i18n";
import {Net} from "@mr/core-network/server/http/config/net";
import {NetCacheDisk} from "services-comun/modules/net/cache/disk";
import {Respuesta} from "@mr/core-network/server/http/respuesta";
import {RouteGroup, type RouteGroupError} from "@mr/core-network/server/http/routes/group";
import {Routes} from "@mr/core-network/server/http/routes";
import type {IWSHandler} from "@mr/core-network/server/websocket/handler";
import {error, info} from "services-comun/modules/utiles/log";
import {isDir, mkdir} from "services-comun/modules/utiles/fs";
import server from "@mr/core-network/server/http/server";
import webSocket from "@mr/core-network/server/websocket";

import type {Configuracion} from "../config";
import type {ConfiguracionNet} from "../config/net";
import {Engine as EngineBase} from ".";
import AdminHandler from "../handlers/admin";
import ErrorHandler from "../handlers/error";
import FaviconHandler from "../handlers/favicon";

/**
 * Opciones de arranque del servidor HTTP para el {@link Engine} HTTP.
 *
 * @property error   - Handler de error personalizado (`RouteGroupError`). Si se omite,
 *   se usa {@link ErrorHandler} del paquete, que responde `404` en JSON.
 * @property idiomas - Configuración i18n del servidor HTTP (idiomas soportados, idioma
 *   por defecto y activación). Si se omite, i18n no se inicializa.
 * @property cache   - Implementación de caché de red. Por defecto se usa {@link NetCacheDisk}.
 */
export interface IConfig {
    error?: RouteGroupError;
    idiomas?: IIdiomas;
    cache?: NetCache;
}

/**
 * Engine HTTP abstracto. Extiende {@link EngineBase} añadiendo:
 *
 * - Arranque de servidor HTTP (`initWebServer`) y HTTPS (`initWebServerS`).
 * - Montaje automático de los handlers internos `Admin` y `Favicon`.
 * - Watcher de shutdown mediante `chokidar` sobre `files/tmp/admin/shutdown.lock`.
 * - Configuración de las variables estáticas de {@link Respuesta} con los metadatos del pod.
 * - Hooks de salud sobreescribibles: `started()`, `ready()`, `ok()`, `okAll()` y `shutdown()`.
 *
 * ### Uso típico
 *
 * ```ts
 * class MiEngine extends Engine<MiConfiguracionNet> {
 *     protected override async init(): Promise<void> {
 *         await super.init(); // monta el watcher de shutdown
 *         this.initWebServer(
 *             [MiGrupo.build(this.configuracion)],
 *             this.configuracion.net,
 *         );
 *     }
 * }
 * ```
 *
 * @template T - Tipo concreto de configuración; debe extender {@link ConfiguracionNet}.
 */
export abstract class Engine<T extends ConfiguracionNet=ConfiguracionNet> extends EngineBase<T> {
    /* STATIC */

    /**
     * Sobreescribe el hook base para configurar las variables estáticas de {@link Respuesta}
     * con los metadatos del pod (service, pod, version, zona) antes de construir la instancia.
     *
     * - En **producción**: `service` = hostname sin las dos últimas partes; `pod` = últimas dos partes.
     * - En **desarrollo**: ambos se toman de `configuracion.pod.servicio`.
     *
     * @param configuracion - Configuración del servicio ya resuelta.
     */
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

    /**
     * Lista de {@link RouteGroup} activos. Se construye en {@link iniciar} y se consulta
     * en {@link okAll} para verificar que todos los handlers están preparados.
     */
    private handlers: RouteGroup[];

    /**
     * Tabla de rutas activa, disponible tras llamar a {@link initWebServer} o
     * {@link initWebServerS}. Útil para introspección (p.ej. listing de rutas en `/admin/doc/`).
     */
    public routes?: Routes;

    protected constructor(configuracion: T, inicio: number) {
        super(configuracion, inicio);

        this.handlers = [];
    }

    /**
     * Sobreescribe el hook base para montar el watcher de shutdown.
     *
     * Si el directorio `files/tmp/` existe, crea `files/tmp/admin/` y lanza un watcher
     * con `chokidar`. Cuando aparece el fichero `shutdown.lock`, invoca {@link abort}
     * y {@link shutdown} para iniciar el apagado graceful del pod.
     *
     * Las subclases **deben** llamar a `super.init()` antes de su propia lógica
     * para garantizar que el watcher quede activo.
     */
    protected override async init(): Promise<void> {
        await super.init();

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
                this.abort("Se ha solicitado el apagado del POD");
                this.shutdown().then(()=>{}).catch(()=>{});
            }
        });
    }

    /**
     * Inicialización interna compartida por {@link initWebServer} y {@link initWebServerS}.
     *
     * Realiza, en orden:
     * 1. Inicializa i18n si `config.idiomas` está definido.
     * 2. Añade los handlers `Admin` y `Favicon` al final de la lista.
     * 3. Aplica la caché (`config.cache` o {@link NetCacheDisk}) a cada handler.
     * 4. Recoge los {@link IWSHandler} de todos los grupos para el servidor WebSocket.
     *
     * @param handlers - Grupos de rutas del servicio (sin Admin ni Favicon).
     * @param config   - Opciones de arranque ({@link IConfig}).
     */
    private iniciar(handlers: RouteGroup[], config: IConfig): IWSHandler[] {
        const webSockets: IWSHandler[] = [];

        if (config.idiomas !== undefined) {
            Idioma.inicializar(config.idiomas);
        }

        handlers.push(AdminHandler(this.configuracion, this));
        handlers.push(FaviconHandler(this.configuracion));

        const cache = config.cache ?? new NetCacheDisk();
        for (const actual of handlers) {
            actual.setCache(cache);
            webSockets.push(...actual.getWSHandlers());
        }

        this.handlers = handlers;

        return webSockets;
    }

    /**
     * Arranca el servidor HTTP.
     *
     * 1. Llama a {@link iniciar} para completar la lista de handlers y recoger WS handlers.
     * 2. Crea (o reutiliza) las {@link Routes} con el handler de error configurado.
     * 3. Arranca el servidor HTTP con {@link server.iniciarHTTP}.
     * 4. Si hay handlers WebSocket, inicia el servidor WebSocket.
     *
     * @param handlers - Grupos de rutas del servicio (sin Admin ni Favicon).
     * @param net      - Configuración de red resuelta (puertos, timeouts…).
     * @param config   - Opciones opcionales de arranque ({@link IConfig}).
     */
    protected initWebServer(handlers: RouteGroup[], net: Net, config: IConfig = {}): void {
        info("Iniciando Servidor Web");

        const ws = this.iniciar(handlers, config);
        this.routes ??= new Routes(handlers, config.error ?? ErrorHandler(this.configuracion));

        const http = server.iniciarHTTP(this.routes, net);
        if (ws.length > 0) {
            info("Iniciando Web Socket");
            webSocket(http, ws);
        }
    }

    /**
     * Arranca el servidor HTTPS de forma fire-and-forget.
     *
     * Idéntico a {@link initWebServer} pero usa {@link server.iniciarHTTPs} (TLS con
     * SNI multi-dominio). Los errores de arranque HTTPS se registran en el log y no
     * propagan la excepción, para no bloquear el proceso si los certificados no están
     * disponibles en desarrollo.
     *
     * @param handlers - Grupos de rutas del servicio (sin Admin ni Favicon).
     * @param net      - Configuración de red resuelta (puertos, timeouts…).
     * @param config   - Opciones opcionales de arranque ({@link IConfig}).
     */
    protected initWebServerS(handlers: RouteGroup[], net: Net, config: IConfig = {}): void {
        info("Iniciando Servidor Web Seguro");

        const ws = this.iniciar(handlers, config);
        this.routes ??= new Routes(handlers, config.error ?? ErrorHandler(this.configuracion));

        void server.iniciarHTTPs(this.routes, net)
            .then((http) => {
                if (ws.length > 0) {
                    info("Iniciando Web Socket Seguro");
                    webSocket(http, ws);
                }
            })
            .catch((err: unknown) => {
                error("Error iniciando HTTPs", err);
            });
    }

    /**
     * Probe de arranque: devuelve `ok()` si el servicio ha completado el inicio.
     * Llamado desde `GET /admin/started/`. Sobreescribir {@link ok} para personalizar.
     */
    public async started(): Promise<void> {
        return this.ok();
    }

    /**
     * Probe de disponibilidad de tráfico: devuelve `ok()` salvo durante el drain.
     * Llamado desde `GET /admin/ready/`. Sobreescribir para devolver rechazo durante
     * períodos en los que el servicio no debe recibir peticiones nuevas.
     */
    public async ready(): Promise<void> {
        return this.ok();
    }

    /**
     * Probe de liveness: verifica que todos los handlers están operativos y llama a {@link ok}.
     * Llamado desde `GET /admin/live/` y `GET /admin/check/`.
     * Rechaza la promesa con `"Handler no preparado"` si algún handler tiene `ok === false`.
     */
    public async okAll(): Promise<void> {
        for (const actual of this.handlers) {
            if (!actual.ok) {
                return Promise.reject("Handler no preparado");
            }
        }
        await this.ok();
    }

    /**
     * Hook de salud genérico. No-op en la clase base.
     * Las subclases lo sobreescriben para añadir comprobaciones propias
     * (p.ej. conexión a BD activa, caché caliente, etc.).
     * Es invocado por {@link started}, {@link ready} y {@link okAll}.
     */
    protected async ok(): Promise<void> {
        return;
    }

    /**
     * Hook de apagado graceful. No-op en la clase base.
     * Invocado automáticamente por {@link init} cuando aparece `shutdown.lock`.
     * Las subclases lo sobreescriben para cerrar conexiones, vaciar buffers o
     * completar tareas en vuelo antes de que el pod sea terminado.
     */
    protected async shutdown(): Promise<void> {
        return;
    }
}
