import {
    Configuracion as ConfiguracionBase,
    IConfiguracion as IConfiguracionBase,
} from "services-comun/modules/utiles/config";

interface IConfiguracionDefault extends IConfiguracionBase {
}
class Configuracion extends ConfiguracionBase<IConfiguracionDefault> implements IConfiguracionDefault {
    /* INSTANCE */
    public constructor(defecto: IConfiguracionDefault, user: Partial<IConfiguracionDefault>, servicio: string, version: string, cronjob: boolean) {
        super(defecto, user, servicio, version, cronjob);
    }

    /* STATIC */
    private static configuracion?: Configuracion;
    public static async load(): Promise<Configuracion> {
        return this.configuracion??=await this.cargar<IConfiguracionDefault>({}) as Configuracion;
    }
}

export {Configuracion};
