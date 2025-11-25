import {GOOGLE} from "logs-base/modules/utiles/config";
import {
    Configuracion as ConfiguracionBase, Google,
    type IConfiguracion as IConfiguracionBase, type IGoogle,
} from "services-comun/modules/utiles/config";

interface IConfiguracionDefault extends IConfiguracionBase {
    google: IGoogle;
}
export class Configuracion extends ConfiguracionBase<IConfiguracionDefault> implements IConfiguracionDefault {
    /* INSTANCE */
    public google: Google;

    public constructor(defecto: IConfiguracionDefault, user: Partial<IConfiguracionDefault>) {
        super(defecto, user);

        this.google = new Google(defecto.google, this.user.google??{});
    }

    /* STATIC */
    public static async load(): Promise<Configuracion> {
        return await this.cargar<IConfiguracionDefault>({
            google: GOOGLE,
        }) as Configuracion;
    }
}
