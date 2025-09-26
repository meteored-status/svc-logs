import {Bulk} from "services-comun/modules/elasticsearch/bulk";
import {Bulk as BulkBase, BulkConfig} from "./";
import {Elasticsearch} from "../../elasticsearch";

export interface ElasticSearchBulkConfig extends BulkConfig {
    getIndex: (obj: any) => string;
    getId: (obj: any) => string;
    getData: (obj: any) => any;
}


export class ElasticSearchBulk extends BulkBase {
    /* STATIC */

    /* INSTANCE */
    private readonly _bulk: Bulk;

    public constructor(client: Elasticsearch, config: ElasticSearchBulkConfig) {
        super(config);
        this._bulk = Bulk.init(client, {
            blockSize: config.chunk,
            refresh: config.waitToSave
        });
    }

    protected override get config(): ElasticSearchBulkConfig {
        return super.config as ElasticSearchBulkConfig;
    }

    protected override async doUpdates(updates: any[]): Promise<void> {
        updates.forEach(update => {
            this._bulk.update({
                index: this.config.getIndex(update),
                id: this.config.getId(update),
                doc: this.config.getData(update)
            });
        })
        const result = await this._bulk.run();

        if (!result) {
            throw new Error("Error al ejecutar el bulk");
        }
    }

    protected override async doInserts(inserts: any[]): Promise<void> {
        inserts.forEach(insert => {
            this._bulk.index({
                index: this.config.getIndex(insert),
                doc: this.config.getData(insert)
            });
        })
        const result = await this._bulk.run();

        if (!result) {
            throw new Error("Error al ejecutar el bulk");
        }
    }
}
