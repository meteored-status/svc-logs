/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: 7cd7f6f875809ea3616c59a3fa10c9e3
 * Versión: 2026.6.17+1-josantoniojimnez
 */

import type {IRouteGroup} from "@mr/core-network/server/http/routes/group/block";
import {RouteGroup} from "@mr/core-network/server/http/routes/group";
import {metricas} from "@mr/core-network/server/http/metrics";
import server from "@mr/core-network/server/http/server";

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
        ];
    }
}

export default (config: Configuracion, engine: Engine): Admin => new Admin(config, engine);
