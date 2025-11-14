import {
    Configuracion as ConfiguracionBase,
    IConfiguracion as IConfiguracionBase,
} from "services-comun/modules/utiles/config";

export interface IConfiguracion extends IConfiguracionBase {
}
export class Configuracion extends ConfiguracionBase<IConfiguracion> implements IConfiguracion {
    /* INSTANCE */
    public constructor(defecto: IConfiguracion, user: Partial<IConfiguracion>, servicios: [string, ...string[]], version: string, cronjob: boolean) {
        super(defecto, user, servicios, version, cronjob);
    }

    /* STATIC */
    private static configuracion?: Configuracion;
    public static async load(): Promise<Configuracion> {
        return this.configuracion??=await this.cargar<IConfiguracion>({
        }) as Configuracion;
    }
}
