import {CONFIG_STATUS_DEFECTO} from "services-comun/modules/status/utiles/config";
import {Configuracion as ConfigGenerico, type IConfiguracion as IConfigGenerico} from "@mr/core-utils/config";
import {
    Configuracion as ConfiguracionBase,
    type IConfiguracion as IConfiguracionBase
} from "services-comun-status/modules/config/service";

/**
 * A qué panel de status habla este servicio, y si le habla.
 *
 * **Estaba en el paquete `logs-status-base`**, con este servicio como único consumidor. Ese paquete traía
 * además una clase `Configuracion` base con este mismo bloque dentro, que no la extendía nadie —este servicio
 * extiende la de `services-comun-status`—, así que se ha quedado por el camino.
 *
 * @property enabled - Si se publica el spec y los monitores. Apagado en desarrollo, que no hay panel al que
 *                     hablarle.
 * @property server  - El servidor al que se publican.
 */
export interface IStatusConfig extends IConfigGenerico {
    enabled: boolean;
    server: string;
}

export class StatusConfig extends ConfigGenerico<IStatusConfig> implements IStatusConfig {
    public readonly enabled: boolean;
    public readonly server: string;

    public constructor(defecto: IStatusConfig, user: Partial<IStatusConfig>) {
        super(defecto, user);

        // `enabled` se compara con `undefined` en vez de con `??` porque es booleano: con `??` un `false`
        // explícito del fichero de configuración se colaría al valor por defecto.
        this.enabled = user.enabled!==undefined?user.enabled:defecto.enabled;
        this.server = user.server??defecto.server;
    }
}

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
