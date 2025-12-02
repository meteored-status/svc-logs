import {ConfigGenerico, IConfigGenerico} from "../../utiles/config";

export interface IElasticSearch extends IConfigGenerico {
    sendIndex: string;
    eventIndex: string;
    receiverIndex: string;
}

export class ElasticSearch extends ConfigGenerico<IElasticSearch> implements IElasticSearch {

    /* STATIC */

    /* INSTANCE */
    public readonly sendIndex: string;
    public readonly eventIndex: string;
    public readonly receiverIndex: string;

    public constructor(defecto: IElasticSearch, user: Partial<IElasticSearch>) {
        super(defecto, user ?? {});

        this.sendIndex = user.sendIndex ?? defecto.sendIndex;
        this.eventIndex = user.eventIndex ?? defecto.eventIndex;
        this.receiverIndex = user.receiverIndex ?? defecto.receiverIndex;
    }

}

export interface IPubSubConfig extends IConfigGenerico {
    topic: string;
    subscription: string;
}

export class PubSubConfig extends ConfigGenerico<IPubSubConfig> implements IPubSubConfig {

    /* STATIC */

    /* INSTANCE */
    public readonly topic: string;
    public readonly subscription: string;

    public constructor(defecto: IPubSubConfig, user: Partial<IPubSubConfig>) {
        super(defecto, user ?? {});

        this.topic = user.topic ?? defecto.topic;
        this.subscription = user.subscription ?? defecto.subscription;
    }

}

export const DEFAULT_PUBSUB_CONFIG: IPubSubConfig = {
    topic: 'meteored-send-task',
    subscription: 'meteored-send-task-sub',
};

export interface IConfiguracion extends IConfigGenerico {
    elasticSearch: IElasticSearch;
    pubSub: IPubSubConfig;
    statisticsControlFile: string;
}

export class Configuracion extends ConfigGenerico<IConfiguracion> implements IConfiguracion {

    /* STATIC */

    /* INSTANCE */
    public readonly elasticSearch: ElasticSearch;
    public readonly pubSub: PubSubConfig;
    public readonly statisticsControlFile: string;

    public constructor(defecto: IConfiguracion, user: Partial<IConfiguracion>) {
        super(defecto, user ?? {});

        this.elasticSearch = new ElasticSearch(defecto.elasticSearch, user.elasticSearch ?? {});
        this.pubSub = new PubSubConfig(defecto.pubSub, user.pubSub ?? {});
        this.statisticsControlFile = user.statisticsControlFile ?? defecto.statisticsControlFile;
    }
}
