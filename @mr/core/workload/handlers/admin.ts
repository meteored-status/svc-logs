/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 27 Jul 2026 06:26:52 GMT
 * Hash: e0ff33ddc69ebc21fdac049e8de57712
 * Versión: 2026.7.27+1-josantoniojimnez
 * Anterior: 2026.6.17+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-web-www.git
 */

import type {IRouteGroup} from "@mr/core-network/server/http/routes/group/block";
import {RouteGroup} from "@mr/core-network/server/http/routes/group";
import {error} from "services-comun/modules/utiles/log";
import {metricas} from "@mr/core-network/server/http/metrics";
import server, {RUTA_DEBUG_HANDOFF} from "@mr/core-network/server/http/server";

import type {Configuracion} from "../config";
import type {Engine} from "../engine/server";

/**
 * Grupo de rutas de administración interna del servicio.
 *
 * Expone los endpoints de Kubernetes / healthchecks:
 * - `GET /admin/started/` — indica si el servicio ha arrancado.
 * - `GET /admin/ready/`   — indica si el servicio está listo para recibir tráfico.
 * - `GET /admin/live/`    — liveness probe.
 * - `GET /admin/check/`   — alias de `/admin/live/`.
 * - `GET /admin/doc/`     — devuelve la lista de rutas documentables del servicio.
 * - `POST /admin/debug-handoff/` — fuera de producción, cede el puerto HTTP a una
 *   sesión de depuración (ver `Server.cederPuertoParaDebug`); en producción responde 404.
 *
 * Ninguna de estas rutas se incluye en la documentación pública.
 */
class Admin extends RouteGroup {
    public constructor(config: Configuracion, private readonly engine: Engine) {
        super(config);
    }

    protected getHandlers(): IRouteGroup[] {
        return [
            {
                expresiones: [
                    {metodos: ["GET"], exact: "/admin/started/", resumen: "/admin/started/", log: false},
                ],
                handler: async (conexion) => this.engine.started()
                    .then(() => this.sendRespuesta(conexion))
                    .catch((err: unknown) => conexion.error(404, err instanceof Error ? err.message : String(err), err)),
            },
            {
                expresiones: [
                    {metodos: ["GET"], exact: "/admin/ready/", resumen: "/admin/ready/", log: false},
                ],
                handler: async (conexion) => {
                    // Durante el drain (SIGTERM) devolvemos 503 sin cache para que el orquestador
                    // (GKE/Istio) deje de mandarnos tráfico nuevo mientras terminamos las en curso.
                    if (server.isShuttingDown()) {
                        return conexion.noCache().error(503, "shutting down");
                    }
                    return this.engine.ready()
                        .then(() => this.sendRespuesta(conexion))
                        .catch((err: unknown) => conexion.error(404, err instanceof Error ? err.message : String(err), err));
                },
            },
            {
                expresiones: [
                    {metodos: ["GET"], exact: "/admin/live/",  resumen: "/admin/live/",  log: false},
                    {metodos: ["GET"], exact: "/admin/check/", resumen: "/admin/check/", log: false},
                ],
                handler: async (conexion) => this.engine.okAll()
                    .then(() => this.sendRespuesta(conexion))
                    .catch((err: unknown) => conexion.error(404, err instanceof Error ? err.message : String(err), err)),
            },
            {
                expresiones: [
                    {metodos: ["GET"], exact: "/admin/doc/", resumen: "/admin/doc/", log: false},
                ],
                handler: async (conexion) => this.sendRespuesta(conexion, {
                    data: this.engine.routes?.getDocumentables(),
                }),
            },
            {
                expresiones: [
                    {metodos: ["GET"], exact: "/admin/metrics/", resumen: "/admin/metrics/", log: false},
                ],
                handler: async (conexion) => conexion
                    .noCache()
                    .setContentType("text/plain; version=0.0.4; charset=utf-8")
                    .sendData(Buffer.from(metricas.formatPrometheus(), "utf-8")),
            },
            {
                expresiones: [
                    {metodos: ["POST"], exact: RUTA_DEBUG_HANDOFF, resumen: RUTA_DEBUG_HANDOFF, log: false},
                ],
                handler: async (conexion) => {
                    if (PRODUCCION) {
                        return conexion.error(404, "not found");
                    }
                    return this.sendRespuesta(conexion, {data: {cedido: true}})
                        .finally(() => {
                            server.cederPuertoParaDebug()
                                .catch((err: unknown) => error("Error cediendo el puerto HTTP para depuración", err));
                        });
                },
            },
        ];
    }
}

export default (config: Configuracion, engine: Engine): Admin => new Admin(config, engine);
