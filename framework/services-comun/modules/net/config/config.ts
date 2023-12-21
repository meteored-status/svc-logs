import {Configuracion} from "../../utiles/config";
import {INet, Net} from "./net";
import {Service} from "../service";

export interface IConfiguracionNet {
    net?: INet;
}
export class ConfiguracionNet<T extends IConfiguracionNet=IConfiguracionNet> extends Configuracion<T> implements IConfiguracionNet {
    /* STATIC */

    /* INSTANCE */
    public readonly net: Net;

    protected constructor(defecto: T, user: Partial<T>, servicio: string, version: string, cronjob: boolean, SERVICES?: Service) {
        super(defecto, user, servicio, version, cronjob);

        if (defecto.net==undefined) {
            if (SERVICES==undefined) {
                throw new Error("Parámetro SERVICES no definido");
            }
            defecto.net = SERVICES.configuracion(this.pod.servicio)
        }

        this.net = new Net(defecto.net, user.net??{});
    }
}
