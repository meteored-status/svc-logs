import {BulkError} from "./error";
import {
    BulkOperation,
    BulkOperationCreate,
    BulkOperationDelete,
    BulkOperationScript,
    BulkOperationUpdate,
} from "./operation";
import {Elasticsearch, Refresh, Script} from "..";

export interface BulkConfig {
    blockSize?: number;
    index?: string;
    refresh?: Refresh;
}

interface IBulkParams {
    index?: string;
    id?: string;
}

export interface IBulkParamsID extends IBulkParams {
    id: string;
}

export interface IBulkParamsDoc<T> extends IBulkParams {
    doc: T;
}

export interface IBulkParamsScript<T> extends IBulkParamsID {
    script: Script;
    doc?: T;
}

export interface IBulkParamsUpdate<T> extends IBulkParamsID {
    doc: Partial<T>;
    crear?: boolean;
    upsert?: T;
    retry_on_conflict?: number;
}

export abstract class BulkBase {
    /* STATIC */

    /* INSTANCE */
    protected readonly config: BulkConfig;
    protected readonly operaciones: BulkOperation[];

    protected constructor(protected elastic: Elasticsearch, config: BulkConfig) {
        this.config = config;
        this.operaciones = [];
    }

    protected checkOperacion(index?: string): string {
        index ??= this.config.index;
        if (index==undefined) {
            throw new BulkError("Index is required");
        }

        return index;
    }

    protected push(op: BulkOperation): BulkOperation {
        this.operaciones.push(op);

        return op;
    }

    public create<T extends object>({index, id, doc}: IBulkParamsDoc<T>): BulkOperation {
        return this.push(BulkOperationCreate.build(this.checkOperacion(index), doc, id));
    }

    public delete({index, id}: IBulkParamsID): BulkOperation {
        return this.push(BulkOperationDelete.build(this.checkOperacion(index), id));
    }

    public index<T extends object>({index, id, doc}: IBulkParamsDoc<T>): BulkOperation {
        return this.push(BulkOperationCreate.build(this.checkOperacion(index), doc, id));
    }

    public script<T extends object|undefined>({index, id, script, doc}: IBulkParamsScript<T>): BulkOperation {
        return this.push(BulkOperationScript.build(this.checkOperacion(index), id, script, doc));
    }

    public update<T extends object>({index, id, doc, crear, upsert, retry_on_conflict}: IBulkParamsUpdate<T>): BulkOperation {
        return this.push(BulkOperationUpdate.build(this.checkOperacion(index), id, doc, crear, upsert, retry_on_conflict));
    }
}
