import {GOOGLE} from "logs-base/modules/utiles/config";
import {
    Configuracion as ConfiguracionBase, Google,
    IConfiguracion as IConfiguracionBase, IGoogle,
} from "services-comun/modules/utiles/config";

interface IConfiguracionDefault extends IConfiguracionBase {
    google: IGoogle;
}
export class Configuracion extends ConfiguracionBase<IConfiguracionDefault> implements IConfiguracionDefault {
    /* INSTANCE */
    public google: Google;

    public constructor(defecto: IConfiguracionDefault, user: Partial<IConfiguracionDefault>, servicio: string, version: string, cronjob: boolean) {
        super(defecto, user, servicio, version, cronjob);

        this.google = new Google(defecto.google, this.user.google??{});
    }

    /* STATIC */
    private static configuracion?: Configuracion;
    public static async load(): Promise<Configuracion> {
        return this.configuracion??=await this.cargar<IConfiguracionDefault>({
            google: GOOGLE,
        }) as Configuracion;
    }
}
