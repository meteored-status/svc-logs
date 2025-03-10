import client from "services-comun/modules/status/client/client";
import {LogsSpec, TGroup} from "logs-status-base/modules/status/status";
import {Configuracion} from "../utiles/config";
import {IClusterData, IClusters, IWorkspace} from "services-comun/modules/status/client/spec";
import {Monitor} from "services-comun/modules/status/client/monitor";
import {Component} from "services-comun/modules/status/client/component";

type ISpec = IWorkspace<ISlaveWorkspace>;

export interface ISlaveWorkspace {
    clusters: IClusters<IClusterDataSlave>;
}

export interface IClusterDataSlave extends IClusterData {
    elastic: ISlaveElastic;
}

interface ISlaveElastic {
    current_publish: ISlaveElasticCurrentPublish;
}

interface ISlaveElasticCurrentPublish {
    date: number;
    count: number;
    errors: ISlaveElasticError[];
}

interface ISlaveElasticError {
    error: string;
}

const DEFAULT_SPEC = (): ISpec => {
    return {
        data: {
            clusters: {}
        }
    }
}


export class SlaveSpec extends LogsSpec<ISpec> {
    private static _INSTANCE: SlaveSpec|null;

    private static DEFAULT_CLUSTER_DATA = (): IClusterDataSlave => {
        return {
            elastic: {
                current_publish: {
                    date: 0,
                    count: 0,
                    errors: []
                }
            }
        }
    }

    public static async get(config: Configuracion): Promise<SlaveSpec> {
        if (!this._INSTANCE) {
            const c = client(config.status);
            this._INSTANCE = new SlaveSpec(TGroup.LOGS_SLAVE, config, c);
            if (config.status.enabled) await this._INSTANCE.load(DEFAULT_SPEC());
        }
        return this._INSTANCE;
    }

    /* INSTANCE */
    protected override defaultSpec(): ISpec {
        return DEFAULT_SPEC();
    }

    public override get data(): ISpec {
        const data = super.data;
        const workspace = data.data;
        workspace.clusters[this.config.pod.zona] ??= {
            name: this.config.pod.zona,
            data: SlaveSpec.DEFAULT_CLUSTER_DATA()
        };
        return data;
    }

    public get cluster(): IClusterDataSlave {
        const workspace = this.data.data;
        return workspace.clusters[this.config.pod.zona].data;
    }

    protected override async buildWorkspaceMonitors(component: Component): Promise<void> {
        const data = this.cluster;

        const monitorArticles: Monitor = Monitor.build('Logs de Slave');

        const monitorElastic: Monitor = Monitor.build('Elasticsearch');
        const updatedElastic: Date = new Date();
        updatedElastic.setTime(data.elastic.current_publish.date);
        monitorElastic.updated = updatedElastic;

        if (data.elastic.current_publish.errors.length) {
            monitorElastic.error(`Se han producido ${data.elastic.current_publish.errors.length} errores al publicar en elastic`);
        } else  {
            monitorElastic.ok('No se han producido errores al publicar en elastic');
        }

        monitorArticles.addMonitor(monitorElastic);

        component.addMonitor(monitorArticles);
    }

}
