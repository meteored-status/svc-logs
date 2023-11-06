import {UAParser} from "ua-parser-js";
import {hostname} from "node:os";
import geoip from "fast-geoip"

import {type ECS} from "services-comun/modules/elasticsearch/ecs";
import {type INotify} from "services-comun-status/modules/services/logs-slave/backend";
import {type IPodInfo} from "services-comun/modules/utiles/config";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {error} from "services-comun/modules/utiles/log";
import bulk from "services-comun/modules/elasticsearch/bulk";

import {Bucket, type ICliente} from "./bucket";
import {Crawler} from "./source/crawler";
import {SourceCloudflare} from "./source/cloudflare";

const host = hostname();

export class Registro {
    /* STATIC */
    public static async getGeoIP(ip: string) {
        if (ip.length==0) {
            return null;
        }

        try {
            return await geoip.lookup(ip);
        } catch (e) {
            error("Error al obtener la geolocalización de la IP");
            return null;
        }
    }

    public static async build(pod: IPodInfo, cliente: ICliente, data: SourceCloudflare, notify: INotify): Promise<Registro> {
        const geo = await this.getGeoIP(data.ClientIP);
        const ua = data.ClientRequestUserAgent.length>0?UAParser(data.ClientRequestUserAgent):null;
        const crawler = Crawler.test(data.ClientRequestUserAgent);
        const tls = data.ClientSSLProtocol.split("v");
        const duration = data.EdgeTimeToFirstByteMs;
        const url = new URL(`${data.ClientRequestScheme}://${data.ClientRequestHost}${data.ClientRequestURI}`);

        // this.request.geolocation = {
        //     eu: geo.eu!="0",
        //     accuracy: geo.area,
        // };

        // todo cambiar a objetos
        // const tree: EcsExtendedTree = {
        //     agent: {
        //         build: {
        //             original: pod.servicio,
        //         },
        //     },
        // };
        const ecs: ECS = {
            "@timestamp": data.EdgeStartTimestamp,
            agent: {
                build: {
                    original: pod.servicio,
                },
                ephemeral_id: host,
                version: pod.version,
            },
            client: {
                address: data.ClientIP,
                as: {
                    number: data.ClientASN,
                },
                bytes: data.ClientRequestBytes,
                domain: data.ClientRequestHost,
                ip: data.ClientIP,
                port: data.ClientSrcPort,
                registered_domain: data.ZoneName,
                subdomain: data.ClientRequestHost.substring(0, data.ClientRequestHost.length - data.ZoneName.length - 1),
            },
            // device: {
            //     model: {
            //         name: ua != null ? ua.device.family : undefined,
            //     },
            // },
            destination: {
                domain: data.EdgeRequestHost, // todo averiguar si el destino es otro dominio
                registered_domain: data.ZoneName,
                subdomain: data.EdgeRequestHost.substring(0, data.EdgeRequestHost.length - data.ZoneName.length - 1),
            },
            ecs: {
                version: "8.6.1",
            },
            event: {
                duration: duration>0 ? duration : undefined,
                end: data.EdgeEndTimestamp,
                start: data.EdgeStartTimestamp,
            },
            http: {
                request: {
                    bytes: data.ClientRequestBytes,
                    id: data.RayID,
                    method: data.ClientRequestMethod,
                    referrer: data.ClientRequestReferer,
                },
                response: {
                    body: {
                        bytes: data.EdgeResponseBodyBytes,
                    }
                },
                version: data.ClientRequestProtocol,
            },
            network: {
                protocol: data.ClientRequestScheme,
            },
            tls: {
                cipher: data.ClientSSLCipher,
                next_protocol: data.ClientRequestProtocol.toLowerCase(),
                version: tls[1],
                version_protocol: tls[0].toLowerCase(),
            },
            url: {
                domain: url.host,
                fragment: url.hash.length > 0 ? url.hash : undefined,
                full: url.href,
                // original?: string;
                path: url.pathname,
                port: url.port.length > 0 ? parseInt(url.port) : url.protocol === "https:" ? 443 : 80,
                query: url.search,
                registered_domain: url.host,
                scheme: data.ClientRequestScheme,
                subdomain: url.host.substring(0, url.host.length - data.ZoneName.length - 1),
            },
            user_agent: {
                os: {
                    family: data.ClientDeviceType,
                },
            },
            labels: {
                cache: data.CacheCacheStatus,
                cliente: cliente.id,
                grupo: cliente.grupo,
                crawler: crawler?.name,
                source: Bucket.buildSource(notify),
            },
            tags: [cliente.id, ...cliente.grupo!=undefined?[cliente.grupo]:[]],
        };

        if (geo!=null) {
            ecs.client!.geo = {
                country_iso_code: geo.country,
                region_iso_code: geo.region.length > 0 ? geo.region : undefined,
                timezone: geo.timezone,
                city_name: geo.city.length > 0 ? geo.city : undefined,
                location: {
                    lat: geo.ll[0],
                    lon: geo.ll[1],
                },
            }
        } else {
            ecs.client!.geo = {
                country_iso_code: data.ClientCountry,
            }
        }

        if (data.OriginIP.length>0) {
            ecs.destination = {
                ...ecs.destination,
                address: data.OriginIP,
                bytes: data.OriginResponseBytes,
                ip: data.OriginIP,
            };
            ecs.dns = {
                answers: [
                    {
                        ttl: data.OriginDNSResponseTimeMs,
                    },
                ],
            };
            ecs.http!.response = {
                ...ecs.http!.response,
                bytes: data.OriginResponseBytes,
                status_code: data.OriginResponseStatus,
            };
        } else {
            ecs.destination = {
                ...ecs.destination,
                bytes: data.CacheResponseBytes,
            };
            ecs.http!.response = {
                ...ecs.http!.response,
                bytes: data.CacheResponseBytes,
                status_code: data.CacheResponseStatus,
            };
        }

        if (ua!=null) {
            ecs.user_agent!.os = {
                ...ecs.user_agent!.os,
                full: ua.os.name!=undefined && ua.os.version!=undefined ?
                    `${ua.os.name} ${ua.os.version}` :
                    undefined,
                name: ua.os.name,
                version: ua.os.version,
            };
            ecs.user_agent = {
                ...ecs.user_agent,
                device: {
                    name: ua.device.model,
                },
                name: ua.browser.name,
                original: data.ClientRequestUserAgent,
                version: ua.browser.version,
            }
        }

        // if (crawler!=null) {
        //     console.log(crawler.name, ecs);
        // }

        // console.log(ecs);

        return new this(cliente, notify, ecs);
    }

    /* INSTANCE */
    public constructor(private cliente: ICliente, private notify: INotify, public data: ECS) {
    }

    public toJSON(): ECS {
        return this.data;
    }

    public async save(i: number = 0): Promise<void> {
        bulk.create({
            index: `logs-accesos-${this.cliente.id}`,
            doc: this,
        })
            .catch(async (err)=>{
                if (i<10 && (err.message?.includes("Request timed out") || err.name?.includes("TimeoutError") || err.name?.includes("ConnectionError"))) {
                    const multiplicador = err.name?.includes("ConnectionError") ? 10 : 1;
                    i++;
                    await PromiseDelayed(i * multiplicador * 1000);

                    return this.save(i);
                }

                await Bucket.addRepesca(this.notify, this.cliente, err);
                // error("Error guardando", err);
            })
            .then(()=>{});
    }
}
