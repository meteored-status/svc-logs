/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 22 May 2026 06:09:37 GMT
 * Hash: 50f3a8e4b35aca23d975f06dd58646c8
 * Versión: 2026.5.22+1-josantoniojimnez
 */

import type {IRouteGroup} from "@mr/core-network/server/http/routes/group/block";
import {RouteGroup} from "@mr/core-network/server/http/routes/group";

import type {Configuracion} from "../../utiles/config";
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
