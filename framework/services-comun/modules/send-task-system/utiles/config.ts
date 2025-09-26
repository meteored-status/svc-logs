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

export interface IConfiguracion extends IConfigGenerico {
    elasticSearch: IElasticSearch;
    statisticsControlFile: string;
}

export class Configuracion extends ConfigGenerico<IConfiguracion> implements IConfiguracion {

    /* STATIC */

    /* INSTANCE */
    public readonly elasticSearch: ElasticSearch;
    public readonly statisticsControlFile: string;

    public constructor(defecto: IConfiguracion, user: Partial<IConfiguracion>) {
        super(defecto, user ?? {});

        this.elasticSearch = new ElasticSearch(defecto.elasticSearch, user.elasticSearch ?? {});
        this.statisticsControlFile = user.statisticsControlFile ?? defecto.statisticsControlFile;
    }
}
