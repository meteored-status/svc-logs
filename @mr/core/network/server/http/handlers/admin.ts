/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 10:42:05 GMT
 * Hash: b9a7f0286dce7cf5072769deb0c8b871
 * Versión: 2026.5.18+2-josantoniojimnez
 */

import type {Configuracion} from "services-comun/modules/utiles/config";
import type {EngineServer} from "services-comun/modules/engine_server";

import type {IRouteGroup} from "../routes/group/block";
import {RouteGroup} from "../routes/group";
import {metricas} from "../metrics";
import server from "../server";

/**
 * Grupo de rutas de administración interna del servicio.
 *
 * Expone los endpoints de Kubernetes / healthchecks:
 * - `GET /admin/started/` — indica si el servicio ha arrancado.
 * - `GET /admin/ready/`   — indica si el servicio está listo para recibir tráfico.
 * - `GET /admin/live/`    — liveness probe.
 * - `GET /admin/check/`   — alias de `/admin/live/`.
 * - `GET /admin/doc/`     — devuelve la lista de rutas documentables del servicio.
 *
 * Ninguna de estas rutas se incluye en la documentación pública.
 */
class Admin extends RouteGroup {
    public constructor(config: Configuracion, private readonly engine: EngineServer) {
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
        ];
    }
}

let instancia: Admin|null = null;
export default (config: Configuracion, engine: EngineServer): Admin => {
    return instancia ??= new Admin(config, engine);
};
