import {ConfiguracionNet, type IConfiguracionNet} from "services-comun/modules/net/config/config";
import {SERVICES} from "services-comun-status/modules/services/config";

interface IConfiguracion extends IConfiguracionNet {
}
export class Configuracion extends ConfiguracionNet<IConfiguracion> implements IConfiguracion {
    /* INSTANCE */

    public constructor(defecto: IConfiguracion, user: Partial<IConfiguracion>, servicio: string, version: string, cronjob: boolean) {
        super(defecto, user, servicio, version, cronjob, SERVICES);
    }

    /* STATIC */
    private static configuracion?: Configuracion;
    public static async load(): Promise<Configuracion> {
        return this.configuracion??=await this.cargar<IConfiguracion>({
        }) as Configuracion;
    }
}
