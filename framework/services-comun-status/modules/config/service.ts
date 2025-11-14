import {
    ConfiguracionNet,
    IConfiguracionNet,
} from "services-comun/modules/net/config/config";
import {SERVICES} from "../services/config";

interface IConfiguracion extends IConfiguracionNet {
}
export class Configuracion extends ConfiguracionNet<IConfiguracion> implements IConfiguracion {
    /* INSTANCE */
    public constructor(defecto: IConfiguracion, user: Partial<IConfiguracion>, servicios: [string, ...string[]], version: string, cronjob: boolean) {
        super(defecto, user, servicios, version, cronjob, SERVICES);
    }

    /* STATIC */
    private static configuracion?: Configuracion;
    public static async load(): Promise<Configuracion> {
        return this.configuracion??=await this.cargar<IConfiguracion>({}) as Configuracion;
    }
}
