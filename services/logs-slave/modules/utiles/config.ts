import {ConfiguracionNet, type IConfiguracionNet} from "services-comun/modules/net/config/config";
import {GOOGLE} from "logs-base/modules/utiles/config";
import {Google, type IGoogle} from "services-comun/modules/utiles/config";
import {SERVICES} from "services-comun-status/modules/services/config";
import {IStatusConfig, StatusConfig} from "logs-status-base/modules/utiles/config";
import {CONFIG_STATUS_DEFECTO} from "services-comun/modules/status/utiles/config";

interface IConfiguracion extends IConfiguracionNet {
    google: IGoogle;
    status: IStatusConfig;
}
export class Configuracion extends ConfiguracionNet<IConfiguracion> implements IConfiguracion {
    /* INSTANCE */
    public google: Google;
    public readonly status: StatusConfig;

    public constructor(defecto: IConfiguracion, user: Partial<IConfiguracion>, servicios: [string, ...string[]], version: string, cronjob: boolean) {
        super(defecto, user, servicios, version, cronjob, SERVICES);

        this.google = new Google(defecto.google, this.user.google??{});
        this.status = new StatusConfig(defecto.status, user.status??{});
    }

    /* STATIC */
    private static configuracion?: Configuracion;
    public static async load(): Promise<Configuracion> {
        return this.configuracion??=await this.cargar<IConfiguracion>({
            google: GOOGLE,
            status: {
                ...CONFIG_STATUS_DEFECTO
            }
        }) as Configuracion;
    }
}
