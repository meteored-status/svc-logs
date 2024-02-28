import {ConfigGenerico, type IConfigGenerico} from "../../utiles/config";

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
