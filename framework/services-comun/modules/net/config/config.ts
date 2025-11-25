import {Configuracion, IConfiguracion} from "../../utiles/config";
import {INet, Net} from "./net";
import {Service} from "../service";
import type {IPodInfo} from "../../utiles/pod";

export interface IConfiguracionNet extends IConfiguracion {
    net?: INet;
}
export class ConfiguracionNet<T extends IConfiguracionNet=IConfiguracionNet> extends Configuracion<T> implements IConfiguracionNet {
    /* STATIC */

    /* INSTANCE */
    public readonly net: Net;

    protected constructor(defecto: T, user: Partial<T>, services?: Service) {
        super(defecto, user);

        if (!defecto.net) {
            if (!services) {
                throw new Error("Parámetro SERVICES no definido");
            }
            defecto.net = services.configuracion(this.pod.servicio)
        }

        this.net = new Net(defecto.net, user.net??{});
    }
}
