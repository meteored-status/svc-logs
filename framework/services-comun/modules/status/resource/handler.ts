/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:22:11 GMT
 * Hash: a1e270bb8eeb03b443f2362e64c3f7df
 * Versión: 2026.6.17+4-josantoniojimnez
 * Anterior: 2026.5.22+1-josantoniojimnez
 */

import type {Configuracion} from "@mr/core-workload/config";
import type {IRouteGroup} from "@mr/core-network/server/http/routes/group/block";
import {RouteGroup} from "@mr/core-network/server/http/routes/group";

import type {IResourceGroup} from "./resource";

export abstract class Status<T extends Configuracion> extends RouteGroup<T> {
    /* INSTANCE */
    protected getHandlers(): IRouteGroup[] {
        return [
            {
                expresiones: [
                    {
                        metodos: ["GET"],
                        exact: `/status/${this.getWorkspace()}/`,
                        resumen: "/status/{workspace}/"
                    }
                ],
                handler: async (conexion) => {
                    try {
                        return this.sendRespuesta<IResourceGroup[]>(conexion, {
                            data: await this.buildResourceGroup(),
                        });
                    } catch (err) {
                        if (err instanceof Error) {
                            return this.sendError(conexion, {
                                message: err.message,
                                extra: err.stack,
                            });
                        }

                        return this.sendError(conexion, {
                            message: "Error procesando la petición",
                            extra: err,
                        });
                    }
                }
            }
        ];
    }

    protected abstract getWorkspace(): string;
    protected abstract buildResourceGroup(dominio?: string): Promise<IResourceGroup[]>;
}
