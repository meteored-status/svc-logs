import {CONFIG_STATUS_DEFECTO} from "services-comun/modules/status/utiles/config";
import {
    Configuracion as ConfiguracionBase,
    type IConfiguracion as IConfiguracionBase
} from "services-comun-status/modules/config/service";
import {type IStatusConfig, StatusConfig} from "logs-status-base/modules/utiles/config";

interface IConfiguracion extends IConfiguracionBase {
    status: IStatusConfig;
}
export class Configuracion extends ConfiguracionBase<IConfiguracion> implements IConfiguracion {
    /* INSTANCE */
    public readonly status: StatusConfig;

    public constructor(defecto: IConfiguracion, user: Partial<IConfiguracion>) {
        super(defecto, user);

        this.status = new StatusConfig(defecto.status, user.status??{});
    }

    /* STATIC */
    public static override async load(): Promise<Configuracion> {
        return await this.cargar<IConfiguracion>({
            status: {
                ...CONFIG_STATUS_DEFECTO
            },
        }) as Configuracion;
    }
}
