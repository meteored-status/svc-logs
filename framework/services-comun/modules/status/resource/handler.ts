import type {Configuracion} from "../../utiles/config";
import type {IResourceGroup} from "./resource";
import type {IRouteGroup} from "../../net/routes/group/block";
import {RouteGroup} from "../../net/routes/group";

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
