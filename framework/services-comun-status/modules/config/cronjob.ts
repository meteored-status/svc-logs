import {
    Configuracion as ConfiguracionBase,
    IConfiguracion as IConfiguracionBase,
} from "services-comun/modules/utiles/config";

export interface IConfiguracion extends IConfiguracionBase {
}
export class Configuracion extends ConfiguracionBase<IConfiguracion> implements IConfiguracion {
    /* INSTANCE */
    public constructor(defecto: IConfiguracion, user: Partial<IConfiguracion>) {
        super(defecto, user);
    }

    /* STATIC */
    public static async load(): Promise<Configuracion> {
        return this.cargar<IConfiguracion, Configuracion>({});
    }
}
