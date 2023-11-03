import {ConfiguracionNet, IConfiguracionNet} from "services-comun/modules/net/config/config";
import {EService, SERVICES} from "services-comun-status/modules/services/config";
import {Google, IGoogle} from "services-comun/modules/utiles/config";

interface IConfiguracion extends IConfiguracionNet {
    google: IGoogle;
}
class Configuracion extends ConfiguracionNet<IConfiguracion> implements IConfiguracion {
    /* INSTANCE */
    public google: Google;

    public constructor(defecto: IConfiguracion, user: Partial<IConfiguracion>, servicio: string, version: string, cronjob: boolean) {
        super(defecto, user, servicio, version, cronjob);

        this.google = new Google(defecto.google, this.user.google??{});
    }

    /* STATIC */
    private static configuracion?: Configuracion;
    public static async load(): Promise<Configuracion> {
        return this.configuracion??=await this.cargar<IConfiguracion>({
            net: SERVICES.configuracion(EService.status_logs_slave),
            google: {
                id: "api-project-858154548956",
                storage: {
                    credenciales: "files/credenciales/storage.json",
                    buckets: {},
                },
            },
        }) as Configuracion;
    }
}

export {Configuracion};
