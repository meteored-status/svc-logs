import type {Conexion} from "../../net/conexion";
import type {Configuracion} from "../../utiles/config";
import type {IResourceGroup} from "./resource";
import type {IRouteGroup} from "../../net/routes/group/block";
import {RouteGroup} from "../../net/routes/group";

export abstract class Status<T extends Configuracion> extends RouteGroup<T> {
    /* STATIC */

    /* INSTANCE */
    // protected constructor(configuracion: T) {
    //     super(configuracion);
    // }

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
                handler: async (conexion: Conexion) => {
                    return this.sendRespuesta<IResourceGroup[]>(conexion, {
                        data: await this.buildResourceGroup(),
                    });
                }
            }
        ];
    }

    protected abstract getWorkspace(): string;
    protected abstract buildResourceGroup(): Promise<IResourceGroup[]>;
}
