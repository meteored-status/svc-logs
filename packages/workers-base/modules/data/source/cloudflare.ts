import {z} from "zod";
import readline from "node:readline/promises";

import {type INotify} from "services-comun-status/modules/services/logs-slave/backend";
import {Storage} from "services-comun/modules/fs/storage";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {error, info} from "services-comun/modules/utiles/log";
import bulk from "services-comun/modules/elasticsearch/bulk";
import elasticsearch from "services-comun/modules/elasticsearch/elastic";

import {Bucket, ICliente} from "../bucket";

export interface SourceCloudflare {
    "@timestamp":       Date;
    entrypoint?:        string;
    event:              Event;
    eventType:          "fetch" | "tail";
    exceptions?:        string[];
    logs?:              string[];
    outcome:            "ok" | "canceled" | "exception";
    scriptName:         string;
    scriptTags?:        string[];
    scriptVersion:      ScriptVersion;
    dispatchNamespace?: string;
    source:             string;
}

export interface Event {
    rayID:    string;
    request:  Request;
    response: Response;
}

export interface Request {
    url:    string;
    method: string;
}

export interface Response {
    status: number;
}

export interface ScriptVersion {
    id:       string;
    message?: string;
    tag?:     string;
}

function  hacerUndefinedLength<T extends {length:number}>(v: T): T|undefined {
    return v.length>0?v:undefined;
}

export class Cloudflare {
    /* STATIC */
    private static SCHEMA = z.object({
        Entrypoint:        z.string()        .transform(hacerUndefinedLength).optional(),
        Event:             z.object({
            RayID:         z.string(),
            Request:       z.object({
                URL:       z.string(),
                Method:    z.string(),
            }).strict(),
            Response:      z.object({
                Status:    z.number(),
            }).strict(),
        }),
        EventTimestampMs:  z.coerce.date(),
        EventType:         z.enum(["fetch", "tail"]),
        Exceptions:        z.any().array().transform(lineas=>lineas.map(linea=>JSON.stringify(linea))).transform(hacerUndefinedLength).optional(),
        Logs:              z.any().array().transform(lineas=>lineas.map(linea=>JSON.stringify(linea))).transform(hacerUndefinedLength).optional(),
        Outcome:           z.enum(["ok", "canceled", "exception"]),
        ScriptName:        z.string(),
        ScriptTags:        z.string().array().transform(hacerUndefinedLength).optional(),
        ScriptVersion:     z.object({
            ID:            z.string(),
            Message:       z.string()        .transform(hacerUndefinedLength).optional(),
            Tag:           z.string()        .transform(hacerUndefinedLength).optional(),
        }).strict(),
        DispatchNamespace: z.string()        .transform(hacerUndefinedLength).optional(),
        source: z.string(),
    }).strict().transform(o=>({
        "@timestamp": o.EventTimestampMs,
        entrypoint: o.Entrypoint,
        event: {
            rayID: o.Event.RayID,
            request: {
                url: o.Event.Request.URL,
                method: o.Event.Request.Method,
            },
            response: {
                status: o.Event.Response.Status,
            },
        },
        eventType: o.EventType,
        exceptions: o.Exceptions,
        logs: o.Logs,
        outcome: o.Outcome,
        scriptName: o.ScriptName,
        scriptTags: o.ScriptTags,
        scriptVersion: {
            id: o.ScriptVersion.ID,
            message: o.ScriptVersion.Message,
            tag: o.ScriptVersion.Tag,
        },
        dispatchNamespace: o.DispatchNamespace,
        source: o.source,
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
            return Cloudflare.SCHEMA.parse({
                ...JSON.parse(json),
                source,
            });
        } catch (e) {
            error("Cloudflare.parse", JSON.stringify(e));
            return null;
        }
    }
}
