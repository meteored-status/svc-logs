import {error} from "../../utiles/log";
import {
    type BulkOperation,
    BulkOperationCreate,
    BulkOperationDelete,
    BulkOperationScript,
    BulkOperationUpdate,
} from "./operation";
import type {Elasticsearch, Script} from "..";

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
    public static init(elastic: Elasticsearch, index?: string): Bulk {
        return new this(elastic, index);
    }

    /* INSTANCE */
    public correctos: number;
    public erroneos: number;
    public finalizado: boolean;
    public ok: boolean;
    public tiempoEnvio: number;
    public tiempoTotal: number;

    protected operaciones: BulkOperation<any>[];

    private readonly start: number;

    public get length(): number { return this.operaciones.length; }

    protected constructor(protected readonly elastic: Elasticsearch, protected readonly indice?: string) {
        this.correctos = 0;
        this.erroneos = 0;
        this.finalizado = false;
        this.ok = false;
        this.tiempoEnvio = 0;
        this.tiempoTotal = 0;

        this.operaciones = [];

        this.start = Date.now();
    }

    private checkIndex(index?: string): string {
        if (this.finalizado) {
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

    public async run(): Promise<boolean> {
        if (this.finalizado) {
            return this.ok;
        }

        this.finalizado = true;

        const start = Date.now();
        this.ok = await this.ejecutar(this.operaciones);
        this.tiempoEnvio = Date.now() - start;
        this.tiempoTotal = Date.now() - this.start;

        return this.ok;
    }

    private async ejecutar(operaciones: BulkOperation[]): Promise<boolean> {
        if (operaciones.length==0) {
            return true;
        }

        const data = await this.elastic.bulk({
            index: this.indice,
            operations: operaciones.flatMap(op=>op.operations),
            refresh: "wait_for",
        })

        if (!data.errors) {
            this.correctos = operaciones.length;
            for (const operacion of operaciones) {
                operacion.resolve();
            }
            return true;
        }

        let ok = true;
        const repesca: BulkOperation[] = [];
        const reportados: string[] = [];
        for (let i=0, len=operaciones.length; i<len; i++) {
            const actual = data.items[i].create!;
            if (actual.error!=undefined) {
                if (actual.status==429) {
                    repesca.push(operaciones[i]);
                } else {
                    if (!reportados.includes(actual.error.type)) {
                        reportados.push(actual.error.type);
                        error("Error irrecuperable de Bulk", JSON.stringify(actual.error));
                    }
                    this.erroneos++;
                    ok = false;
                    operaciones[i].reject(actual.error);
                }
            } else {
                this.correctos++;
                operaciones[i].resolve();
            }
        }

        if (repesca.length==0) {
            return ok;
        }

        return await this.ejecutar(repesca) && ok;
    }
}
