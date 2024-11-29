import {arrayChop} from "../../utiles/array";
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
    limit?: number;
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

    private readonly limit?: number;
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

        // this.limit = Number.MAX_SAFE_INTEGER;
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

        const oks = await Promise.all(arrayChop(this.operaciones.splice(0), this.limit).map(bloque=>this.ejecutarBloque(bloque)));
        const ok = oks.every(ok=>ok);

        return await this.ejecutar() && ok;
    }

    private async ejecutarBloque(operaciones: BulkOperation[]): Promise<boolean> {
        const data = await this.elastic.bulk({
            index: this.indice,
            operations: operaciones.flatMap(op=>op.operations),
            refresh: this.refresh,
        });

        if (!data.errors) {
            this.correctos += operaciones.length;
            for (const op of operaciones) {
                op.resolve();
            }
            return true;
        }

        let ok = true;
        const reportados: string[] = [];
        for (let i=0, len=operaciones.length; i<len; i++) {
            const obj = data.items[i];
            const item = obj.index ?? obj.create ?? obj.update ?? obj.delete!;
            const op = operaciones[i];

            if (item.error!=undefined) {
                if (item.status==429) {
                    this.operaciones.push(op);
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

        return ok;
    }
}
