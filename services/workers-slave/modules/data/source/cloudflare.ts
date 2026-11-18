import readline from "node:readline/promises";

import type {Storage} from "services-comun/modules/fs/storage";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {error, info} from "services-comun/modules/utiles/log";
import bulk from "services-comun/modules/utiles/elastic/bulk";
import elasticsearch from "services-comun/modules/utiles/elastic";

import {Bucket, type ICliente, type INotify} from "../bucket";
import {type IRegistroCloudflare, parsearLinea} from "./cloudflare-schema";

export interface SourceCloudflare extends IRegistroCloudflare {
    source: string;
}

/**
 * Líneas descartadas de un fichero con el mismo motivo.
 *
 * @property lineas  - Cuántas.
 * @property ejemplo - La primera, recortada, para poder ver un caso real sin volcarlas todas.
 */
interface IDescarte {
    lineas:  number;
    ejemplo: string;
}

export class Cloudflare {
    /* STATIC */

    private static readonly EJEMPLO_MAX = 2000;

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
        const descartes = new Map<string, IDescarte>();
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

            const texto = linea.trim();
            const parseo = parsearLinea(texto);
            if (!parseo.ok) {
                const descarte = descartes.get(parseo.motivo);
                if (descarte!==undefined) {
                    descarte.lineas++;
                } else {
                    descartes.set(parseo.motivo, {lineas: 1, ejemplo: texto.slice(0, this.EJEMPLO_MAX)});
                }
                continue;
            }

            promesas.push(this.guardar(cliente, {...parseo.registro, source}, notify, repesca));
            lineas++;
        }
        await Promise.all(promesas);

        if (descartes.size>0) {
            this.informarDescartes(source, descartes);
        }

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
                error("Error indexando en Elasticsearch", JSON.stringify(err));
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

    /**
     * Un único `error()` por fichero con las líneas que no se han podido parsear, agrupadas por
     * motivo y con un ejemplo de cada uno. Así un tipo de evento nuevo de Cloudflare se ve, pero no
     * escribe una línea de log por evento.
     *
     * @param source - Fichero de origen (`gs://...`).
     * @param descartes - Descartes agrupados por motivo.
     */
    private static informarDescartes(source: string, descartes: Map<string, IDescarte>): void {
        let total = 0;
        const motivos: Record<string, IDescarte> = {};
        for (const [motivo, descarte] of descartes) {
            total += descarte.lineas;
            motivos[motivo] = descarte;
        }
        error(`Cloudflare.parse: ${total} líneas descartadas en ${source}`, JSON.stringify(motivos));
    }
}
