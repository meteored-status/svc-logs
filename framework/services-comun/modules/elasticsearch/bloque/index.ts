import {error} from "../../utiles/log";
import {
    type BulkOperation,
    BulkOperationCreate,
    BulkOperationDelete,
    BulkOperationScript,
    BulkOperationUpdate,
} from "./operation";
import type {Elasticsearch} from "..";
import type {Script} from "..";

interface IBulkParams {
    index?: string;
    id?: string;
}

interface IBulkParamsID extends IBulkParams {
    id: string;
}

interface IBulkParamsDoc<T> extends IBulkParams {
    doc: T;
}

interface IBulkParamsScript extends IBulkParamsID {
    script: Script;
}

interface IBulkParamsUpdate<T> extends IBulkParamsID {
    doc: Partial<T>;
    crear?: boolean;
    upsert?: T;
}

export class Bulk {
    /* STATIC */
    public static init(index?: string): Bulk {
        return new this(index);
    }

    /* INSTANCE */
    protected operaciones: BulkOperation<any>[];
    private cerrado: boolean;
    private ok: boolean;

    protected constructor(protected readonly indice?: string) {
        this.operaciones = [];
        this.cerrado = false;
        this.ok = false;
    }

    private checkIndex(index?: string): string {
        if (this.cerrado) {
            throw new Error("This Bulk is closed");
        }

        index ??= this.indice;
        if (index==undefined) {
            throw new Error("Index is required");
        }

        return index;
    }

    public create<T>({index, id, doc}: IBulkParamsDoc<T>): BulkOperation<T> {
        const operacion = new BulkOperationCreate(this.checkIndex(index), doc, id);
        this.operaciones.push(operacion);

        return operacion;
    }

    public delete({index, id}: IBulkParamsID): BulkOperation {
        const operacion = new BulkOperationDelete(this.checkIndex(index), id);
        this.operaciones.push(operacion);

        return operacion;
    }

    public index<T>({index, id, doc}: IBulkParamsDoc<T>): BulkOperation<T> {
        const operacion = new BulkOperationCreate(this.checkIndex(index), doc, id);
        this.operaciones.push(operacion);

        return operacion;
    }

    public script({index, id, script}: IBulkParamsScript): BulkOperation {
        const operacion = new BulkOperationScript(this.checkIndex(index), id, script);
        this.operaciones.push(operacion);

        return operacion;
    }

    public update<T>({index, id, doc, crear, upsert}: IBulkParamsUpdate<T>): BulkOperation<Partial<T>> {
        const operacion = new BulkOperationUpdate(this.checkIndex(index), id, doc, crear, upsert);
        this.operaciones.push(operacion);

        return operacion;
    }

    public async run(elastic: Elasticsearch): Promise<boolean> {
        if (this.cerrado) {
            return this.ok;
        }

        this.cerrado = true;

        return this.ok = await this.ejecutar(elastic, this.operaciones);
    }

    private async ejecutar(elastic: Elasticsearch, operaciones: BulkOperation[]): Promise<boolean> {
        if (operaciones.length==0) {
            return true;
        }

        const data = await elastic.bulk({
            index: this.indice,
            operations: operaciones.map(operacion=>operacion.operations).flat(),
            refresh: "wait_for",
        })

        if (!data.errors) {
            for (const operacion of operaciones) {
                operacion.resolve(true);
            }
            return true;
        }

        let ok = true;
        const repesca: BulkOperation[] = [];
        for (let i=0, len=operaciones.length; i<len; i++) {
            const actual = data.items[i].create!;
            if (actual.error!=undefined) {
                if (actual.status==429) {
                    repesca.push(operaciones[i]);
                } else {
                    error("Error irrecuperable de Bulk", actual.error);
                    operaciones[i].reject(actual.error);
                    ok = false;
                }
            }
        }

        return await this.ejecutar(elastic, repesca) && ok;
    }
}