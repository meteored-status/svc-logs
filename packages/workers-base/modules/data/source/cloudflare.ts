import {z} from "zod";
import readline from "node:readline/promises";

import {type INotify} from "services-comun-status/modules/services/logs-slave/backend";
import {Storage} from "services-comun/modules/fs/storage";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {error, info} from "services-comun/modules/utiles/log";
import bulk from "services-comun/modules/elasticsearch/bulk";
import elasticsearch from "services-comun/modules/elasticsearch/elastic";

import {Bucket, type ICliente} from "../bucket";

export interface SourceCloudflare {
    "@timestamp": Date;
    entrypoint?:  string;
    status:       "ok" | "canceled" | "exception";
    script:       string;
    event:        Event;
    exceptions?:  Exception[];
    logs?:        string[];
    tags?:        string[];
    version:      ScriptVersion;
    namespace?:   string;
    source:       string;
}

interface Event {
    rayID:    string;
    request:  Request;
    response: Response;
    type:     "fetch" | "tail";
}

interface Request {
    url:    string;
    method: string;
}

interface Response {
    status: number;
}

interface Exception {
    name: string;
    message: string;
    timestamp: Date;
}

interface ScriptVersion {
    id:       string;
    message?: string;
    tag?:     string;
}

function  hacerUndefinedLength<T extends {length:number}>(v: T): T|undefined {
    return v.length>0?v:undefined;
}

export class Cloudflare {
    /* STATIC */
    private static readonly SCHEMA_EVENT_REQUEST = z.object({
        URL:    z.string(),
        Method: z.string(),
    }).strict().transform(o=>({
        url: o.URL,
        method: o.Method,
    }));

    private static readonly SCHEMA_EVENT_RESPONSE = z.object({
        Status: z.number(),
    }).strict().transform(o=>({
        status: o.Status,
    }));

    private static readonly SCHEMA_EVENT = z.object({
        RayID:    z.string(),
        Request:  this.SCHEMA_EVENT_REQUEST,
        Response: this.SCHEMA_EVENT_RESPONSE,
    }).strict().transform(o=>({
        rayID: o.RayID,
        request: o.Request,
        response: o.Response,
    }));

    private static readonly SCHEMA_EXCEPTIONS = z.object({
        Name:          z.string(),
        Message:       z.string(),
        Timestamp:     z.coerce.date(),
    }).strict().transform(o=>({
        name: o.Name,
        message: o.Message,
        timestamp: o.Timestamp,
    })).array().transform(hacerUndefinedLength).optional();

    private static readonly SCHEMA_VERSION = z.object({
        ID:      z.string(),
        Message: z.string().transform(hacerUndefinedLength).optional(),
        Tag:     z.string().transform(hacerUndefinedLength).optional(),
    }).strict().transform(o=>({
        id: o.ID,
        message: o.Message,
        tag: o.Tag,
    }));

    private static readonly SCHEMA = z.object({
        Entrypoint:        z.string()        .transform(hacerUndefinedLength).optional(),
        Event:             this.SCHEMA_EVENT,
        EventTimestampMs:  z.coerce.date(),
        EventType:         z.enum(["fetch", "tail"]),
        Exceptions:        this.SCHEMA_EXCEPTIONS,
        Logs:              z.any().array().transform(lineas=>lineas.map(linea=>JSON.stringify(linea))).transform(hacerUndefinedLength).optional(),
        Outcome:           z.enum(["ok", "canceled", "exception"]),
        ScriptName:        z.string(),
        ScriptTags:        z.string().array().transform(hacerUndefinedLength).optional(),
        ScriptVersion:     this.SCHEMA_VERSION,
        DispatchNamespace: z.string()        .transform(hacerUndefinedLength).optional(),
    }).strict().transform(o=>({
        "@timestamp": o.EventTimestampMs,
        entrypoint: o.Entrypoint,
        status: o.Outcome,
        script: o.ScriptName,
        event: {
            rayID: o.Event.rayID,
            request: o.Event.request,
            response: o.Event.response,
            type: o.EventType,
        },
        exceptions: o.Exceptions,
        logs: o.Logs,
        tags: o.ScriptTags,
        version: o.ScriptVersion,
        namespace: o.DispatchNamespace,
    }));

    public static async ingest(cliente: ICliente, notify: INotify, storage: Storage, signal: AbortSignal, repesca: boolean): Promise<number> {
        let ok = true;
        signal.addEventListener("abort", ()=>{
            ok = false;
        }, {once: true});

        const source = Bucket.buildSource(notify);

        if (repesca) {
            const time = Date.now();
            // eliminar las entradas que coincidan con el mismo source antes de meter las nuevas para evitar duplicados
            const cantidad = await this.limpiarDuplicados(cliente, source);
            if (cantidad > 0) {
                info(`Limpiados ${cantidad} registros duplicados de ${cliente.id} - ${source} en ${Date.now() - time}ms`);
            }
        }

        const promesas: Promise<void>[] = [];
        let lineas = 0;
        const lector = readline.createInterface({
            input: storage.stream,
            crlfDelay: Infinity,
            terminal: false,
        });

        for await (const linea of lector) {
            if (!ok) {
                lector.close();
                return Promise.reject(new Error("Abortado"));
            }
            if (linea.length==0) {
                continue;
            }

            const registro = this.parse(linea.trim(), source);
            if (registro==null) {
                continue;
            }

            promesas.push(this.guardar(cliente, registro, notify, repesca));
            lineas++;
        }
        await Promise.all(promesas);

        return lineas;
    }

    private static async limpiarDuplicados(cliente: ICliente, source: string, retry=0): Promise<number> {
        try {
            const data = await elasticsearch.search({
                index: `workers-accesos-${cliente.id}`,
                query: {
                    term: {
                        source,
                    },
                },
                _source: false,
                size: 10000,
            });

            if (data.hits.hits.length==0) {
                return 0;
            }

            await Promise.all(data.hits.hits.map(actual=>bulk.delete({
                index: actual._index,
                id: actual._id,
                doc: undefined,
            // }).catch(err=>{
            //     error(err);
            //     return Promise.reject(err);
            })));

            return data.hits.hits.length + await this.limpiarDuplicados(cliente, source);
        } catch (err) {
            if (retry>10) {
                error(err);
            }
            await PromiseDelayed(retry*100);
            return this.limpiarDuplicados(cliente, source, retry+1);
        }
    }

    private static async guardar(cliente: ICliente, raw: SourceCloudflare, notify: INotify, repesca: boolean, i: number = 0): Promise<void> {

        bulk.create({
            index: `logs-worker-${cliente.id}`,
            doc: raw,
        })
            .catch(async (err)=>{
                console.log(err);
                if (i<10 && (err.message?.includes("Request timed out") || err.name?.includes("TimeoutError") || err.name?.includes("ConnectionError"))) {
                    const multiplicador = err.name?.includes("ConnectionError") ? 10 : 1;
                    i++;
                    await PromiseDelayed(i * multiplicador * 1000);

                    return this.guardar(cliente, raw, notify, repesca, i);
                }

                await Bucket.addRepesca(notify, repesca, cliente, err);
                // error("Error guardando", err);
            })
            .then(()=>{});

    }

    private static parse(json: string, source: string): SourceCloudflare|null {
        try {
            return {
                ...Cloudflare.SCHEMA.parse(JSON.parse(json)),
                source,
            };
        } catch (e) {
            error("Cloudflare.parse", JSON.stringify(e));
            return null;
        }
    }
}
