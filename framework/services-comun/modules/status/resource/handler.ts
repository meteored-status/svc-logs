import {Conexion} from "../../net/conexion";
import {Configuracion} from "../../utiles/config";
import {IResourceGroup} from "./resource";
import {IRespuesta} from "../../net/interface";
import {IRouteGroup} from "../../net/routes/group/block";
import {RouteGroup} from "../../net/routes/group";

export abstract class Status<T extends Configuracion> extends RouteGroup<T> {
    /* STATIC */

    /* INSTANCE */
    protected constructor(configuracion: T) {
        super(configuracion);
    }

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
                    return conexion.sendRespuesta<IRespuesta<IResourceGroup[]>>({
                        ...Conexion.baseDefecto(),
                        data: await this.buildResourceGroup()
                    });
                }
            }
        ];
    }

    protected abstract getWorkspace(): string;

    protected abstract buildResourceGroup(): Promise<IResourceGroup[]>;
}
