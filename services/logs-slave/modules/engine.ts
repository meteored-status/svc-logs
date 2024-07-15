import {EngineServer} from "services-comun/modules/engine_server";
import elasticsearch from "services-comun/modules/elasticsearch/elastic";

import {Configuracion} from "./utiles/config";

import Slave from "./net/handlers/slave";

export class Engine extends EngineServer<Configuracion> {
    /* STATIC */

    /* INSTANCE */
    public override async ejecutar(): Promise<void> {
        this.initWebServer([
            Slave(this.configuracion, this.abortSignal),
        ], this.configuracion.net);

        await super.ejecutar();

        const data: any = await elasticsearch.search({
            index: "logs-accesos-tiempo",
            "query": {
                "bool": {
                    "must": [
                        {
                            "range": {
                                "@timestamp": {
                                    "gte": "2024-05-14T00:00:00.000Z",
                                    "lt": "2024-05-15T00:00:00.000Z"
                                }
                            }
                        },
                        {
                            "wildcard": {
                                "url.query": {
                                    "value": "*affiliate_id=4d2x2ax7ckag*"
                                }
                            }
                        }
                    ]
                }
            },
            "aggs": {
                "query": {
                    "terms": {
                        "field": "url.query",
                        "size": 4000
                    }
                }
            },
            "size": 0,
            "_source": [
                "url.query"
            ],
            "track_total_hits": true
        });

        const total = data.hits.total.value;
        const idiomas: string[] = [];
        const localidades: number[] = [];
        for (const hit of data.aggregations.query.buckets) {
            const [, idioma, localidad] = /\?api_lang=(\w{2})&localidad=(\d+)&affiliate_id=4d2x2ax7ckag/.exec(hit.key)!;
            const loc = parseInt(localidad);
            if (!idiomas.includes(idioma)) {
                idiomas.push(idioma);
            }
            if (!localidades.includes(loc)) {
                localidades.push(loc);
            }
        }
        console.log("Total peticiones:", total);
        console.log("Idiomas:", idiomas);
        console.log("Localidades:", localidades.length);
    }

    protected override async ok(): Promise<void> {
        await elasticsearch.info();
    }
}
