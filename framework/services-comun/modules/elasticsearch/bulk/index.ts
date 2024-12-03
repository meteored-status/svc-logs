import {BulkBase, type BulkConfig} from "./base";
import type {BulkOperation,} from "./operation";
import {Elasticsearch} from "..";
import {arrayChop} from "../../utiles/array";
import {error} from "../../utiles/log";

export class Bulk extends BulkBase {
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

    private readonly start: number;

    protected constructor(elastic: Elasticsearch, config: BulkConfig) {
        super(elastic, config);

        this.correctos = 0;
        this.erroneos = 0;
        this.finalizado = false;
        this.length = 0;
        this.ok = false;
        this.tiempoEnvio = 0;
        this.tiempoTotal = 0;

        this.start = Date.now();
    }

    protected override checkOperacion(index?: string): string {
        if (this.finalizado) {
            throw new Error("This Bulk is closed");
        }

        return super.checkOperacion(index);
    }

    public add(...ops: BulkOperation[]): void {
        for (const op of ops) {
            this.push(op);
        }
    }

    protected override push(op: BulkOperation): BulkOperation {
        this.length++;
        return super.push(op);
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

        const oks = await Promise.all(arrayChop(this.operaciones.splice(0), this.config.blockSize).map(bloque=>this.ejecutarBloque(bloque)));
        const ok = oks.every(ok=>ok);

        return await this.ejecutar() && ok;
    }

    private async ejecutarBloque(operaciones: BulkOperation[]): Promise<boolean> {
        const data = await this.elastic.bulk({
            index: this.config.index,
            operations: operaciones.flatMap(op=>op.operations),
            refresh: this.config.refresh ?? false,
        }).catch((err)=>{
            if (err instanceof Error) {
                error("Error enpetición Bulk", err.name, err.message);
            }
            return Promise.reject(err);
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
            const op = operaciones[i];
            const obj = data.items[i];
            if (obj==null) {
                console.log("Tenemos un item a NULL", i, len, operaciones.length, data.items.length);
                continue;
            }
            const item = obj.index ?? obj.create ?? obj.update ?? obj.delete!;

            if (item.error!=undefined) {
                if (item.status==429) {
                    this.operaciones.push(op);
                } else {
                    if (!reportados.includes(item.error.type)) {
                        reportados.push(item.error.type);
                        error("Error irrecuperable de Bulk", JSON.stringify(item.error), JSON.stringify(op.operations));
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
