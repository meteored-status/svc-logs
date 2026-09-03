import {RouteGroup} from "@mr/core-network/server/http/routes/group";
import type {IRouteGroup} from "@mr/core-network/server/http/routes/group/block";
import {error, warning} from "services-comun/modules/utiles/log";

import {ClienteGCS} from "../../data/cliente/gcs";
import {parsearResourceName} from "../resource";

import type {Configuracion} from "../../utiles/config";

/**
 * Notificación de Cloud Storage entregada por Pub/Sub (push) con forma de Cloud Audit Log.
 */
interface IMessage {
    protoPayload: {
        resourceName: string;
    };
}

class Slave extends RouteGroup<Configuracion>{
    /* INSTANCE */
    protected getHandlers(): IRouteGroup[] {
        return [
            {
                expresiones: [
                    {
                        metodos: ["POST"],
                        exact: "/",
                        checkQuery: false,
                        resumen: "/",
                    },
                ],
                handler: async (conexion) => {
                    const post = conexion.post as Partial<IMessage>;

                    conexion.noCache();

                    // respondemos 200 pase lo que pase: Pub/Sub reintentaría la entrega y buena
                    // parte de los rechazos de aquí (bucket no registrado, cliente desconocido) no
                    // son transitorios
                    const resourceName = post.protoPayload?.resourceName;
                    if (resourceName===undefined) {
                        return this.sendRespuesta(conexion);
                    }

                    const recurso = parsearResourceName(resourceName);
                    if (recurso===undefined) {
                        warning("Notificación con resourceName inesperado", resourceName);

                        return this.sendRespuesta(conexion);
                    }

                    try {
                        const cliente = await ClienteGCS.searchBucket(recurso.bucket, recurso.path);
                        await cliente.ingest(this.configuracion.google, recurso.path);
                    } catch (err) {
                        error("Error procesando", recurso.bucket, recurso.path, err instanceof Error ? err.message : err);
                    }

                    return this.sendRespuesta(conexion);
                },
            },
        ];
    }
}

export default (config: Configuracion)=>new Slave(config);
