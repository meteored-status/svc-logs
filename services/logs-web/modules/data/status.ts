import type {Client} from "services-comun/modules/status/client/client";
import type {Component} from "services-comun/modules/status/client/component";
import type {IClusterData, IClusters, IWorkspace} from "services-comun/modules/status/client/spec";
import {Monitor} from "services-comun/modules/status/client/monitor";
import {Spec} from "services-comun/modules/status/client/spec";
import {Status} from "services-comun/modules/status/client/status";
import client from "services-comun/modules/status/client/client";

import type {Configuracion} from "../utiles/config";

/**
 * El spec de este servicio en el panel de status: qué monitores publica y con qué datos.
 *
 * **Absorbe la clase `LogsSpec` del paquete `logs-status-base`**, que era abstracta con esta como única
 * implementación: una base para varios servicios que nunca tuvo más que uno. Con la herencia deshecha se
 * quedaron fuera `determineDiffTime()` y `TTimeUnit`, que no los llamaba nadie y además eran una copia de lo
 * que ya hay en `services-comun/modules/utiles/fecha.ts` — con más unidades.
 */

/** El id de este servicio en el panel de status. */
const SERVICE = 16;

/** Bajo qué nombre se guarda el spec. Es el identificador con el que agrupa el panel. */
export enum TGroup {
    LOGS_SLAVE = "logs_slave",
}

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


export class SlaveSpec extends Spec<ISpec> {
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
            this._INSTANCE = new SlaveSpec(config, c);
            if (config.status.enabled) await this._INSTANCE.load(DEFAULT_SPEC());
        }
        return this._INSTANCE;
    }

    /* INSTANCE */
    private constructor(private readonly config: Configuracion, c: Client) {
        super(SERVICE, c, TGroup.LOGS_SLAVE);
    }

    /**
     * **Ojo: esto no devuelve lo que se cargó, devuelve un `DEFAULT_SPEC()` nuevo en cada llamada.**
     *
     * Es literalmente lo que hacía antes —`LogsSpec` sobrescribía `data` para devolver `defaultSpec()` y aquí
     * se llamaba a `super.data`—, y se conserva tal cual al deshacer la herencia porque cambiarlo tiene
     * consecuencias que no son de este refactor: ver el aviso de `cluster()`.
     */
    public override get data(): ISpec {
        const data = DEFAULT_SPEC();
        const workspace = data.data;
        workspace.clusters[this.config.pod.zona] ??= {
            name: this.config.pod.zona,
            data: SlaveSpec.DEFAULT_CLUSTER_DATA()
        };
        return data;
    }

    /**
     * ⚠️ **Cada acceso devuelve un árbol recién creado, así que lo que se le escriba se pierde.** Viene de
     * arriba: `data` no devuelve lo cargado sino un `DEFAULT_SPEC()` nuevo.
     *
     * El efecto está en `data/error.ts`: el `catch` de la escritura hace `cluster.…errors.push(…)`,
     * `cluster.…count++` y `cluster.…date = …` en **tres** objetos distintos, y `buildMonitors()` lee un
     * cuarto —con `errors: []` y `date: 0`—. O sea que el monitor de Elasticsearch informa siempre de que no
     * ha habido errores, y su fecha de actualización es siempre 1970. Y `save()` persiste `_data`, que solo
     * escribe `load()`, así que tampoco queda registro.
     *
     * **No se arregla aquí a propósito.** Arreglarlo es hacer que `data` devuelva un árbol que persista entre
     * llamadas, y eso enciende un monitor que lleva verde desde que existe: es una decisión de operación, no
     * de este refactor, que solo deshace dos paquetes.
     */
    public get cluster(): IClusterDataSlave {
        const workspace = this.data.data;
        return workspace.clusters[this.config.pod.zona].data;
    }

    private async buildWorkspaceMonitors(component: Component): Promise<void> {
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

    /**
     * Publica los monitores de este servicio en el panel de status. Venía de `LogsSpec`.
     *
     * Con el status apagado no hace nada: es lo que permite arrancar el servicio en desarrollo sin un panel
     * al que hablarle.
     */
    public async buildMonitors(): Promise<void> {
        if (!this.config.status.enabled) {
            return;
        }

        const zona = this.config.pod.zona;

        const c = client(this.config.status);
        const status: Status = Status.init(SERVICE, this.config.pod, c);

        const component: Component = status.addComponent(`${this.config.pod.servicio} - ${zona}`);

        await this.buildWorkspaceMonitors(component);

        await status.save();
        await this.save();
    }
}
