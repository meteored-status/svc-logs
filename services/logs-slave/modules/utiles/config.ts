import {
    Configuracion as ConfiguracionBase,
    type IConfiguracion as IConfiguracionBase
} from "services-comun-status/modules/config/service";
import {Google, type IGoogle} from "services-comun/modules/utiles/config";

interface IConfiguracion extends IConfiguracionBase {
    google: IGoogle;
}
export class Configuracion extends ConfiguracionBase<IConfiguracion> implements IConfiguracion {
    /* INSTANCE */
    public google: Google;

    public constructor(defecto: IConfiguracion, user: Partial<IConfiguracion>) {
        super(defecto, user);

        this.google = new Google(defecto.google, this.user.google??{});
    }

    /* STATIC */
    public static override async load(): Promise<Configuracion> {
        return await this.cargar<IConfiguracion>({
            google: {
                id: "meteored-status",
                storage: {
                    credenciales: "files/credenciales/storage.json",
                    buckets: {},
                },
            },
        }) as Configuracion;
    }
}
