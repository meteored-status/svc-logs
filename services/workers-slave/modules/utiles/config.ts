import {ConfiguracionNet, type IConfiguracionNet} from "services-comun/modules/net/config/config";
import {GOOGLE} from "workers-base/modules/utiles/config";
import {Google, type IGoogle} from "services-comun/modules/utiles/config";
import {SERVICES} from "services-comun-status/modules/services/config";

interface IConfiguracion extends IConfiguracionNet {
    google: IGoogle;
}
export class Configuracion extends ConfiguracionNet<IConfiguracion> implements IConfiguracion {
    /* INSTANCE */
    public google: Google;

    public constructor(defecto: IConfiguracion, user: Partial<IConfiguracion>, servicios: [string, ...string[]], version: string, cronjob: boolean) {
        super(defecto, user, servicios, version, cronjob, SERVICES);

        this.google = new Google(defecto.google, this.user.google??{});
    }

    /* STATIC */
    private static configuracion?: Configuracion;
    public static async load(): Promise<Configuracion> {
        return this.configuracion??=await this.cargar<IConfiguracion>({
            google: GOOGLE,
        }) as Configuracion;
    }
}
