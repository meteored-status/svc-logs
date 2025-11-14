import {
    ConfigGenerico, Configuracion as ConfiguracionBase,
    IConfigGenerico,
    IConfiguracion as IConfiguracionBase
} from "services-comun/modules/utiles/config";

export interface IStatusConfig extends IConfigGenerico {
    enabled: boolean;
    server: string;
}

export class StatusConfig extends ConfigGenerico<IStatusConfig> implements IStatusConfig {
    public readonly enabled: boolean;
    public readonly server: string;

    public constructor(defecto: IStatusConfig, user: Partial<IStatusConfig>) {
        super(defecto, user);
        this.enabled = user.enabled!==undefined?user.enabled:defecto.enabled;
        this.server = user.server??defecto.server;
    }
}

export interface IConfiguracion extends IConfiguracionBase {
    status: IStatusConfig;
}

export class Configuracion<T extends IConfiguracion = IConfiguracion> extends ConfiguracionBase<T> {
    /* INSTANCE */
    public readonly status: StatusConfig;

    public constructor(defecto: T, user: Partial<T>, servicios: [string, ...string[]], version: string, cronjob: boolean) {
        super(defecto, user, servicios, version, cronjob);

        this.status = new StatusConfig(defecto.status, user.status??{});
    }
}
