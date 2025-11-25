import {
    ConfiguracionNet,
    type IConfiguracionNet,
} from "services-comun/modules/net/config/config";

import {SERVICES} from "../services/config";

export interface IConfiguracion extends IConfiguracionNet {
}
export class Configuracion<T extends IConfiguracion = IConfiguracion> extends ConfiguracionNet<T> implements IConfiguracion {
    /* INSTANCE */
    public constructor(defecto: T, user: Partial<T>) {
        super(defecto, user, SERVICES);
    }

    /* STATIC */
    public static async load(): Promise<Configuracion> {
        return await this.cargar<IConfiguracion>({}) as Configuracion;
    }
}
