import {
    type BulkBase,
    BulkCreate,
    BulkDelete,
    BulkIndex,
    BulkScript,
    BulkUpdate,
    type IBulkBase,
} from "./documento";
import type {Elasticsearch, ESBulkResponse as ESBulkResponseBase, BulkResponseItem, Script} from "..";
import {arrayChop} from "../../utiles/array";
import {error, info} from "../../utiles/log";
import {PromiseDelayed} from "../../utiles/promise";

export interface ESBulkResponse extends ESBulkResponseBase {}

export class Bulk {
    /* STATIC */
    private static readonly MAX_LENGTH = 100;

    /* INSTANCE */
    private enviando: number;
    private interval: NodeJS.Timeout | undefined;
    private readonly queue: BulkBase<any>[];

    public get idle(): boolean { return this.interval==undefined && this.enviando==0 && this.length==0; }
    public get length(): number { return this.queue.length; }

    public constructor(protected readonly ES: Elasticsearch) {
        this.enviando = 0;
        this.queue = [];
    }

    public async wait(): Promise<void> {
        while(!this.idle) {
            await PromiseDelayed(10000);
        }
    }

    public async create<T>(doc: IBulkBase<T>, prioritario: boolean = false): Promise<BulkResponseItem> {
        await PromiseDelayed();
        return new Promise<BulkResponseItem>((resolver: Function, rejecter: Function)=>{
            this.push(new BulkCreate<T>(doc, resolver, rejecter), prioritario);
        });
    }

    public async index<T>(doc: IBulkBase<T>, prioritario: boolean = false): Promise<BulkResponseItem> {
        await PromiseDelayed();
        return new Promise<BulkResponseItem>((resolver: Function, rejecter: Function)=>{
            this.push(new BulkIndex<T>(doc, resolver, rejecter), prioritario);
        });
    }

    public async update<T>(doc: IBulkBase<T>, crear: boolean = false, prioritario: boolean = false): Promise<BulkResponseItem> {
        await PromiseDelayed();
        if (doc.id==undefined) {
            if (crear) {
                return this.index(doc, prioritario);
            }
            return Promise.reject("Falta el ID del documento para actualizarlo");
        }
        return new Promise<BulkResponseItem>((resolver: Function, rejecter: Function)=>{
            this.push(new BulkUpdate<T>(doc, resolver, rejecter, crear), prioritario);
        });
    }

    public async delete(doc: IBulkBase<undefined>, prioritario: boolean = false): Promise<BulkResponseItem> {
        await PromiseDelayed();
        return new Promise<BulkResponseItem>((resolver: Function, rejecter: Function)=>{
            this.push(new BulkDelete(doc, resolver, rejecter), prioritario);
        });
    }

    public async script(doc: IBulkBase<Script>, prioritario: boolean = false): Promise<BulkResponseItem> {
        await PromiseDelayed();
        return new Promise<BulkResponseItem>((resolver: Function, rejecter: Function)=>{
            this.push(new BulkScript(doc, resolver, rejecter), prioritario);
        });
    }

    private push<T>(documento: BulkBase<T>, prioritario: boolean): void {
        if (!prioritario) {
            this.queue.push(documento);
        } else {
            this.queue.unshift(documento);
        }

        this.start();
    }

    private start(): void {
        if (this.interval!=undefined) {
            return;
        }

        if (!PRODUCCION && process.env["DEBUG"]!=undefined) {
            info("ElasticSearch => Iniciando bulk");
        }
        let time = Date.now();
        this.interval = setInterval(()=>{
            if (this.queue.length==0) {
                if (Date.now()-time>10000) {
                    if (!PRODUCCION && process.env["DEBUG"]!=undefined) {
                        info("ElasticSearch => Parando bulk");
                    }
                    clearInterval(this.interval);
                    this.interval = undefined;
                }
                return;
            }

            time = Date.now();
            this.intervalo();
        }, 1000);
    }

    // private maxlen = 0;
    private intervalo(): void {
        this.enviando++;

        const length = this.queue.length < Bulk.MAX_LENGTH ?
            this.queue.length :
            Math.floor(this.queue.length/Bulk.MAX_LENGTH)*Bulk.MAX_LENGTH;
        // if (length>this.maxlen) {
        //     this.maxlen = length;
        //     info("ElasticSearch Bulk => Max length", this.maxlen);
        // }
        const bloques = arrayChop(this.queue.splice(0, length), Bulk.MAX_LENGTH);

        PromiseDelayed()
            .then(()=>this.procesar(bloques))
            .catch((err)=>error(err)) // nunca se va a ejecutar
            .finally(()=>{
                if (!PRODUCCION && process.env["DEBUG"]!=undefined) {
                    info({
                        enviados: length,
                        pendientes: this.queue.length,
                    });
                }
                this.enviando--;
            });
    }

    private async procesar(bloques: BulkBase[][]): Promise<void> {
        const promesas: Promise<void>[] = [];
        for (const actual of bloques) {
            promesas.push(this.procesarEjecutar(actual));
            await PromiseDelayed();
        }
        await Promise.all(promesas);
        // await Promise.all(bloques.map(actual=>this.procesarEjecutar(actual)));
    }

    private async procesarEjecutar(operaciones: BulkBase[]): Promise<void> {
        try {
            const data = await this.ES.bulk({
                operations: operaciones.flatMap((actual) => actual.bulk),
            });

            let errores = 0;
            for (let i = 0, len = operaciones.length; i < len; i++) {
                const actual = data.items[i];
                if (!operaciones[i].end(actual)) {
                    errores++;
                }
            }
            if (errores > 0 && !PRODUCCION) {
                error("Errores en bulk", errores);
            }

        } catch (err: any) {

            // error("Error de bulk");//, JSON.stringify(err?.meta?.body ?? (err?.body ?? err)));
            for (const actual of operaciones) {
                actual.reject(err?.body ?? err);
            }

        }

    }
}
