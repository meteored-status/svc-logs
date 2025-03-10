import {IClusterData, Spec} from "services-comun/modules/status/client/spec";
import client, {Client} from "services-comun/modules/status/client/client";
import {Configuracion} from "../utiles/config";
import {Component} from "services-comun/modules/status/client/component";
import {Status} from "services-comun/modules/status/client/status";

interface IDiffTime {
    time: number;
    unit: TTimeUnit;
}

export enum TTimeUnit {
    MINUTE      = 'm',
    SECOND      = 's',
    MILLISECOND = 'ms'
}

export enum TGroup {
    LOGS_SLAVE          = "logs_slave",
}

export abstract class LogsSpec<K> extends Spec<K> {
    /* STATIC */
    protected static readonly SERVICE: number = 16;

    /* INSTANCE */
    protected constructor(group: TGroup, protected readonly config: Configuracion, client: Client) {
        super(LogsSpec.SERVICE, client, group);
    }

    protected abstract defaultSpec(): K;

    public override get data(): K {
        return this.defaultSpec();
    }

    protected determineDiffTime(ms: number): IDiffTime {
        const result: IDiffTime = {
            time: ms,
            unit: TTimeUnit.MILLISECOND
        }

        if (ms > 60000) {
            result.time = parseFloat((ms / 60000).toFixed(2));
            result.unit = TTimeUnit.MINUTE;
        } else if (ms > 1000) {
            result.time = parseFloat((ms / 1000).toFixed(2));
            result.unit = TTimeUnit.SECOND;
        }

        return result;
    }

    public async buildMonitors(): Promise<void> {
        if (this.config.status.enabled) {
            const clusterName: string = this.config.pod.zona;

            const c = client(this.config.status);
            const status: Status = Status.init(LogsSpec.SERVICE, this.config.pod, c);

            const component: Component = status.addComponent(`${this.config.pod.servicio} - ${clusterName}`);

            await this.buildWorkspaceMonitors(component);

            await status.save();
            await this.save();
        }
    }

    protected abstract buildWorkspaceMonitors(component: Component): Promise<void>;

    public abstract get cluster(): IClusterData;
}
