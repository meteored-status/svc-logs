import {error} from "../../utiles/log";
import {
    type BulkOperation,
    BulkOperationCreate,
    BulkOperationDelete,
    BulkOperationScript,
    BulkOperationUpdate,
} from "./operation";
import {Elasticsearch, Refresh, Script} from "..";

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

export interface BulkConfig {
    index?: string;
    refresh?: Refresh;
}

export class Bulk {
    /* STATIC */
    public static init(elastic: Elasticsearch, config: BulkConfig={}): Bulk {
        return new this(elastic, config);
    }

    /* INSTANCE */
    public correctos: number;
    public erroneos: number;
    public finalizado: boolean;
    public length: number;
    public ok: boolean;
    public tiempoEnvio: number;
    public tiempoTotal: number;

    private readonly indice?: string;
    private operaciones: BulkOperation<any>[];
    private readonly refresh: Refresh;
    private readonly start: number;

    protected constructor(private readonly elastic: Elasticsearch, {index, refresh = false}: BulkConfig) {
        this.correctos = 0;
        this.erroneos = 0;
        this.finalizado = false;
        this.length = 0;
        this.ok = false;
        this.tiempoEnvio = 0;
        this.tiempoTotal = 0;

        this.indice = index;
        this.operaciones = [];
        this.refresh = refresh;

        this.start = Date.now();
    }

    private checkOperacion(index?: string): string {
        if (this.finalizado) {
            throw new Error("This Bulk is closed");
        }

        index ??= this.indice;
        if (index==undefined) {
            throw new Error("Index is required");
        }

        return index;
    }

    private push<T>(op: BulkOperation<T>): BulkOperation<T> {
        this.length++;
        this.operaciones.push(op);

        return op;
    }

    public create<T>({index, id, doc}: IBulkParamsDoc<T>): BulkOperation<T> {
        return this.push(new BulkOperationCreate(this.checkOperacion(index), doc, id));
    }

    public delete({index, id}: IBulkParamsID): BulkOperation {
        return this.push(new BulkOperationDelete(this.checkOperacion(index), id));
    }

    public index<T>({index, id, doc}: IBulkParamsDoc<T>): BulkOperation<T> {
        return this.push(new BulkOperationCreate(this.checkOperacion(index), doc, id));
    }

    public script({index, id, script}: IBulkParamsScript): BulkOperation {
        return this.push(new BulkOperationScript(this.checkOperacion(index), id, script));
    }

    public update<T>({index, id, doc, crear, upsert}: IBulkParamsUpdate<T>): BulkOperation<Partial<T>> {
        return this.push(new BulkOperationUpdate(this.checkOperacion(index), id, doc, crear, upsert));
    }

    public async run(): Promise<boolean> {
        if (this.finalizado) {
            return this.ok;
        }

        this.finalizado = true;

        const start = Date.now();
        this.ok = await this.ejecutar();
        this.tiempoEnvio = Date.now() - start;
        this.tiempoTotal = Date.now() - this.start;

        return this.ok;
    }

    private async ejecutar(): Promise<boolean> {
        if (this.operaciones.length==0) {
            return true;
        }

        const data = await this.elastic.bulk({
            index: this.indice,
            operations: this.operaciones.flatMap(op=>op.operations),
            refresh: this.refresh,
        })

        if (!data.errors) {
            this.correctos = this.operaciones.length;
            for (const op of this.operaciones) {
                op.resolve();
            }
            this.operaciones = [];
            return true;
        }

        let ok = true;
        const repesca: BulkOperation[] = [];
        const reportados: string[] = [];
        for (let i=0, len=this.operaciones.length; i<len; i++) {
            const item = data.items[i].create!;
            const op = this.operaciones[i];

            if (item.error!=undefined) {
                if (item.status==429) {
                    repesca.push(op);
                } else {
                    if (!reportados.includes(item.error.type)) {
                        reportados.push(item.error.type);
                        error("Error irrecuperable de Bulk", JSON.stringify(item.error));
                    }
                    this.erroneos++;
                    ok = false;
                    op.reject(item.error);
                }
            } else {
                this.correctos++;
                op.resolve();
            }
        }

        this.operaciones = repesca;
        return await this.ejecutar() && ok;
    }
}
