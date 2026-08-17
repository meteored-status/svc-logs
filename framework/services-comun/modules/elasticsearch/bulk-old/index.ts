/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 05 Aug 2026 06:32:07 GMT
 * Hash: 9eefbc73690922eb48119712407ce19b
 * Versión: 2026.8.5+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-localizacion.git
 */

import {
    type BulkBase,
    BulkCreate,
    BulkDelete,
    BulkIndex,
    BulkScript,
    BulkUpdate,
    type IBulkBase,
} from "./documento";
import {Deferred, PromiseDelayed} from "../../utiles/promise";
import type {Elasticsearch, ESBulkResponse as ESBulkResponseBase, BulkResponseItem, Script} from "..";
import {arrayChop} from "../../utiles/array";
import {error, info} from "../../utiles/log";

export interface ESBulkResponse extends ESBulkResponseBase {}

/**
 * Cola de operaciones de escritura de Elasticsearch: en vez de llamar a `ES.bulk()` por cada
 * documento, acumula las operaciones encoladas con {@link create}/{@link index}/{@link update}/
 * {@link delete}/{@link script} y las envía agrupadas en bloques de {@link MAX_LENGTH} (ver
 * {@link bucle}), lo que reduce drásticamente el número de peticiones bulk cuando se indexan
 * muchos documentos en poco tiempo. Las tandas se envían de una en una: no se comprueba la cola
 * de nuevo hasta que la tanda anterior termina, así que la concurrencia hacia Elasticsearch queda
 * acotada aunque la cola crezca muy rápido.
 */
export class Bulk {
    /* STATIC */
    private static readonly MAX_LENGTH = 100;

    /* INSTANCE */
    private activo: boolean;
    private enviando: number;
    private readonly queue: BulkBase<any>[];

    public get idle(): boolean { return !this.activo && this.enviando==0 && this.length==0; }
    public get length(): number { return this.queue.length; }

    public constructor(protected readonly ES: Elasticsearch) {
        this.activo = false;
        this.enviando = 0;
        this.queue = [];
    }

    /** Espera (haciendo polling cada 10s) hasta que la cola esté vacía y no haya envíos en curso. */
    public async wait(): Promise<void> {
        while(!this.idle) {
            await PromiseDelayed(10000);
        }
    }

    /** Encola una operación `create` (falla si el documento ya existe). */
    public async create<T>(doc: IBulkBase<T>, prioritario: boolean = false): Promise<BulkResponseItem> {
        await PromiseDelayed();
        const deferred = new Deferred<BulkResponseItem>();
        this.push(new BulkCreate<T>(doc, deferred.resolve, deferred.reject), prioritario);
        return deferred.promise;
    }

    /** Encola una operación `index` (crea o reemplaza el documento). */
    public async index<T>(doc: IBulkBase<T>, prioritario: boolean = false): Promise<BulkResponseItem> {
        await PromiseDelayed();
        const deferred = new Deferred<BulkResponseItem>();
        this.push(new BulkIndex<T>(doc, deferred.resolve, deferred.reject), prioritario);
        return deferred.promise;
    }

    /**
     * Encola una operación `update` sobre un documento existente. Si no se indica `doc.id`, solo
     * puede resolverse creando el documento (`index`), así que requiere `crear=true`; en caso
     * contrario rechaza sin llegar a encolar nada.
     */
    public async update<T>(doc: IBulkBase<T>, crear: boolean = false, prioritario: boolean = false): Promise<BulkResponseItem> {
        await PromiseDelayed();
        if (doc.id==undefined) {
            if (crear) {
                return this.index(doc, prioritario);
            }
            return Promise.reject("Falta el ID del documento para actualizarlo");
        }
        const deferred = new Deferred<BulkResponseItem>();
        this.push(new BulkUpdate<T>(doc, deferred.resolve, deferred.reject, crear), prioritario);
        return deferred.promise;
    }

    /** Encola una operación `delete` por id. */
    public async delete(doc: IBulkBase<undefined>, prioritario: boolean = false): Promise<BulkResponseItem> {
        await PromiseDelayed();
        const deferred = new Deferred<BulkResponseItem>();
        this.push(new BulkDelete(doc, deferred.resolve, deferred.reject), prioritario);
        return deferred.promise;
    }

    /** Encola una actualización mediante script. */
    public async script(doc: IBulkBase<Script>, prioritario: boolean = false): Promise<BulkResponseItem> {
        await PromiseDelayed();
        const deferred = new Deferred<BulkResponseItem>();
        this.push(new BulkScript(doc, deferred.resolve, deferred.reject), prioritario);
        return deferred.promise;
    }

    private push<T>(documento: BulkBase<T>, prioritario: boolean): void {
        if (!prioritario) {
            this.queue.push(documento);
        } else {
            this.queue.unshift(documento);
        }

        this.start();
    }

    /** Arranca (si no hay uno ya en marcha) el {@link bucle} que va vaciando la cola. */
    private start(): void {
        if (this.activo) {
            return;
        }
        this.activo = true;

        if (!PRODUCCION && process.env["DEBUG"]!=undefined) {
            info("ElasticSearch => Iniciando bulk");
        }

        void this.bucle(Date.now());
    }

    /**
     * Comprueba la cola cada 1s; si hay operaciones, espera a que {@link intervalo} termine de
     * enviarlas antes de volver a comprobar, así que como máximo hay una tanda en vuelo — evita
     * que ticks sucesivos disparen peticiones bulk solapadas sin límite de concurrencia. Se
     * detiene a sí mismo tras 10s consecutivos con la cola vacía, para no dejar el bucle
     * corriendo indefinidamente entre ráfagas de operaciones.
     */
    private async bucle(ultimaActividad: number): Promise<void> {
        await PromiseDelayed(1000);

        if (this.queue.length==0) {
            if (Date.now()-ultimaActividad>10000) {
                if (!PRODUCCION && process.env["DEBUG"]!=undefined) {
                    info("ElasticSearch => Parando bulk");
                }
                this.activo = false;
                return;
            }
            return this.bucle(ultimaActividad);
        }

        await this.intervalo();
        return this.bucle(Date.now());
    }

    /**
     * Extrae de la cola un múltiplo de {@link MAX_LENGTH} operaciones (o todas, si quedan menos
     * de {@link MAX_LENGTH}) y las envía en bloques de ese tamaño, esperando a que termine todo
     * el envío antes de devolver el control (para que {@link bucle} no dispare la siguiente
     * comprobación mientras esta tanda sigue en curso). Deja en la cola el resto (si la había; se
     * recoge en la siguiente vuelta del bucle), para no enviar nunca un bloque final más pequeño
     * mientras siga habiendo suficientes operaciones para llenar uno entero.
     */
    private async intervalo(): Promise<void> {
        this.enviando++;

        const length = this.queue.length < Bulk.MAX_LENGTH ?
            this.queue.length :
            Math.floor(this.queue.length/Bulk.MAX_LENGTH)*Bulk.MAX_LENGTH;
        const bloques = arrayChop(this.queue.splice(0, length), Bulk.MAX_LENGTH);

        await PromiseDelayed();
        try {
            await this.procesar(bloques);
        } catch (err) {
            error(err); // nunca debería llegar aquí: procesarEjecutar no relanza sus errores
        } finally {
            if (!PRODUCCION && process.env["DEBUG"]!=undefined) {
                info({
                    enviados: length,
                    pendientes: this.queue.length,
                });
            }
            this.enviando--;
        }
    }

    /** Envía cada bloque a {@link procesarEjecutar}, escalonando el arranque de cada uno un tick. */
    private async procesar(bloques: BulkBase[][]): Promise<void> {
        const promesas: Promise<void>[] = [];
        for (const actual of bloques) {
            promesas.push(this.procesarEjecutar(actual));
            await PromiseDelayed();
        }
        await Promise.all(promesas);
    }

    /**
     * Envía un bloque de operaciones en una única petición bulk y resuelve/rechaza la promesa de
     * cada operación según el item de la respuesta que le corresponde. Si la petición entera
     * falla (p.ej. el clúster no responde), rechaza todas las operaciones del bloque con el
     * mismo error; a diferencia de {@link "../bulk/index.ts"} no reintenta operaciones con
     * error 429 (rate limit).
     */
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
            for (const actual of operaciones) {
                actual.reject(err?.body ?? err);
            }

        }

    }
}
