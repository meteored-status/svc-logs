import {type BulkResponseItem, type ErrorCause, type Script} from "@elastic/elasticsearch/lib/api/types";
import {PromiseDelayed} from "../utiles/promise";

import {
    BulkBase,
    BulkCreate,
    BulkDelete,
    BulkIndex,
    BulkScript,
    BulkUpdate,
    IBulkBase,
} from "./bulk/documento";
import {ESBulkResponse as ESBulkResponseBase} from "./base";
import {arrayChop} from "../utiles/array";
import {error, info} from "../utiles/log";
import elasticsearch from "./elastic";

declare const PRODUCCION: boolean;

export interface ESBulkResponse extends ESBulkResponseBase {}

class Bulk {
    /* STATIC */
    private static readonly MAX_LENGTH = 1000;
    private static LENGTH = 1000;

    /* INSTANCE */
    private enviando: number;
    private interval: NodeJS.Timeout | undefined;
    private readonly queue: BulkBase<any>[];

    public get idle(): boolean { return this.interval==undefined && this.enviando==0 && this.length==0; }
    public get length(): number { return this.queue.length; }

    public constructor() {
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

    private intervalo(): void {
        this.enviando++;

        const length = this.queue.length < Bulk.LENGTH ?
            this.queue.length :
            Math.floor(this.queue.length/Bulk.LENGTH)*Bulk.LENGTH;
        const bloques = arrayChop(this.queue.splice(0, length), Bulk.LENGTH);

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
        for (const actual of bloques) {
            await this.procesarEjecutar(actual);
        }

        // const promesas: Promise<void>[] = [];
        // for (const actual of bloques) {
        //     promesas.push(this.procesarEjecutar(actual));
        //     if (promesas.length>=5) {
        //         await Promise.allSettled(promesas);
        //         promesas.splice(0, promesas.length);
        //     }
        // }
        // if (promesas.length>0) {
        //     await Promise.allSettled(promesas);
        // }

        // await Promise.all(bloques.map(actual=>this.procesarEjecutar(actual)));
    }

    private async procesarEjecutar(operaciones: BulkBase[]): Promise<void> {
        try {
            const data = await elasticsearch.bulk({
                operations: operaciones.flatMap(actual=>actual.bulk),
            });

            let errores = 0;
            let demasiados = false;
            for (let i = 0, len = operaciones.length; i < len; i++) {
                const actual = data.items[i];
                const resultado = operaciones[i].end(actual);
                if (resultado!=undefined) {
                    errores++;
                    demasiados ||= this.isDemasiados(resultado);
                }
            }
            if (demasiados) {
                Bulk.LENGTH = Bulk.MAX_LENGTH/10;
            } else {
                Bulk.LENGTH = Bulk.MAX_LENGTH;
            }
            if (!PRODUCCION && errores > 0) {
                error("Errores en bulk", errores);
            }

        } catch (e: any) {

            const err = ((e?.meta?.body)??e?.body)??e;
            // error("Error de bulk");//, JSON.stringify(err?.meta?.body ?? (err?.body ?? err)));
            let demasiados = false;

            for (const actual of operaciones) {

                actual.reject(err);
                demasiados ||= this.isDemasiados(err);
            }
            if (demasiados) {
                Bulk.LENGTH = Bulk.MAX_LENGTH/10;
            }

        }

    }

    private isDemasiados(err: ErrorCause): boolean {
        switch(err?.type) {
            case "es_rejected_execution_exception":
                return true;
            default:
                return false;
        }
    }
}

const bulk = new Bulk();

export default bulk;
