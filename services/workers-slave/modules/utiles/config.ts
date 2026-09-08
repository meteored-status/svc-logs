import {
    Configuracion as ConfiguracionBase,
    type IConfiguracion as IConfiguracionBase
} from "services-comun-status/modules/config/service";
import {Google, type IGoogle} from "@mr/core-workload/config/google";

/**
 * Configuración GCP por defecto. `storage.buckets` va vacío a propósito: los buckets no se declaran
 * de forma estática, se resuelven en ejecución contra la tabla MySQL `buckets` (`Bucket.findBucket`).
 */
const GOOGLE: IGoogle = {
    id: "api-project-858154548956",
    storage: {
        credenciales: "files/credenciales/storage.json",
        buckets: {},
    },
};

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
            google: GOOGLE,
        }) as Configuracion;
    }
}
