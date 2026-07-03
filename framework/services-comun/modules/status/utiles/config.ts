/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: f5a2ebbd8bef26b0764a90bf9399acb7
 * Versión: 2026.6.17+3-josantoniojimnez
 */

import {Configuracion as ConfigGenerico, type IConfiguracion as IConfigGenerico} from "@mr/core-workload/config";

export interface IStatusConfig extends IConfigGenerico {
    enabled: boolean;
    server: string;
}

export class StatusConfig extends ConfigGenerico<IStatusConfig> implements IStatusConfig {
    public readonly enabled: boolean;
    public readonly server: string;

    public constructor(defecto: IStatusConfig, user: Partial<IStatusConfig>) {
        super(defecto, user);

        this.enabled = user.enabled??defecto.enabled;
        this.server = user.server??defecto.server;
    }
}

export const CONFIG_STATUS_DEFECTO: IStatusConfig = {
    enabled: PRODUCCION && !TEST,
    server: "https://status.meteored.com",
};
