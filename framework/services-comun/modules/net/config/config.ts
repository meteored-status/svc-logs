import {Configuracion} from "../../utiles/config";
import {INet, Net} from "./net";

export interface IConfiguracionNet {
    net: INet;
}
export class ConfiguracionNet<T extends IConfiguracionNet=IConfiguracionNet> extends Configuracion<T> implements IConfiguracionNet {
    /* STATIC */

    /* INSTANCE */
    public readonly net: Net;

    protected constructor(defecto: T, user: Partial<T>, servicio: string, version: string, cronjob: boolean) {
        super(defecto, user, servicio, version, cronjob);

        this.net = new Net(defecto.net, user.net??{});
    }
}
