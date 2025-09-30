import readline from "node:readline/promises";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {z} from "zod";

import {Bulk} from "services-comun/modules/elasticsearch/bulk";
import {Storage} from "services-comun/modules/fs/storage";
import {info} from "services-comun/modules/utiles/log";
import elastic from "services-comun/modules/utiles/elastic";

import type {Cliente} from "../cliente";
import {type IRAWData, Registro} from "../registro/";
import type {Telemetry} from "../telemetry";

export class Cloudflare {
    /* STATIC */
    private static FILTRAR_PATHS_PREFIX: string[] = [
        "/cdn-cgi/"
    ];

    private static readonly SCHEMA_COOKIES = z.object({
        "cf-access-user": z.string().optional(),
    }).transform(o=>({
        "user": o["cf-access-user"],
    }));

    private static readonly SCHEMA_REQUEST_HEADERS = z.object({
        "x-api-key": z.string().optional(),
    }).transform(o=>({
        apiKey: o["x-api-key"],
    }));
    private static readonly SCHEMA_RESPONSE_HEADERS = z.object({
        "cache-tags": z.string().optional(),
        etag: z.string().optional(),
        expires: z.coerce.date().optional(),
        "last-modified": z.coerce.date().optional(),
        "x-meteored-node": z.string().optional(),
        "x-meteored-node-chain": z.string().optional(),
        "x-meteored-service": z.string().optional(),
        "x-meteored-version": z.string().optional(),
        "x-meteored-zone": z.string().optional(),
    }).transform(o=>({
        tags: o["cache-tags"]!=undefined?o["cache-tags"].split(","):undefined,
        etag: o.etag,
        expires: o.expires!=undefined?new Date(o.expires):undefined,
        lastModified: o["last-modified"],
        mr: {
            chain: o["x-meteored-node-chain"]!=undefined?o["x-meteored-node-chain"].split(","):undefined,
            node: o["x-meteored-node"],
            service: o["x-meteored-service"],
            version: o["x-meteored-version"],
            zone: o["x-meteored-zone"],
        },
    }));

    private static readonly SCHEMA = z.object({
        ClientIP: z.string(),
        ClientRequestHost: z.string(),
        ClientRequestMethod: z.string(),
        ClientRequestURI: z.string(),
        EdgeEndTimestamp: z.union([z.string(), z.number()])
            .transform(o=>{
                if (typeof o === "number") {
                    return new Date(Math.floor(o/1000000));
                }
                return new Date(o);
            }),
        EdgeResponseBytes: z.number(),
        EdgeResponseStatus: z.number(),
        EdgeStartTimestamp: z.union([z.string(), z.number()])
            .transform(o=>{
                if (typeof o === "number") {
                    return new Date(Math.floor(o/1000000));
                }
                return new Date(o);
            }),
        RayID: z.string(),
        CacheCacheStatus: z.string(),
        CacheResponseBytes: z.number(),
        CacheResponseStatus: z.number(),
        CacheTieredFill: z.boolean(),
        ClientASN: z.number(),
        ClientCountry: z.string(),
        ClientDeviceType: z.string(),
        ClientIPClass: z.string(),
        ClientMTLSAuthCertFingerprint: z.string(),
        ClientMTLSAuthStatus: z.string(),
        ClientRegionCode: z.string().optional(),
        ClientRequestBytes: z.number(),
        ClientRequestPath: z.string(),
        ClientRequestProtocol: z.string(),
        ClientRequestReferer: z.string(),
        ClientRequestScheme: z.string(),
        ClientRequestSource: z.string(),
        ClientRequestUserAgent: z.string(),
        ClientSSLCipher: z.string(),
        ClientSSLProtocol: z.string(),
        ClientSrcPort: z.number(),
        ClientTCPRTTMs: z.number(),
        ClientXRequestedWith: z.string(),
        Cookies: this.SCHEMA_COOKIES,
        ContentScanObjResults: z.array(z.string()).optional(),
        ContentScanObjTypes: z.array(z.string()).optional(),
        EdgeCFConnectingO2O: z.boolean(),
        EdgeColoCode: z.string(),
        EdgeColoID: z.number(),
        EdgePathingOp: z.string(),
        EdgePathingSrc: z.string(),
        EdgePathingStatus: z.string(),
        EdgeRateLimitAction: z.string(),
        EdgeRateLimitID: z.number(),
        EdgeRequestHost: z.string(),
        EdgeResponseBodyBytes: z.number(),
        EdgeResponseCompressionRatio: z.number(),
        EdgeResponseContentType: z.string(),
        EdgeServerIP: z.string(),
        EdgeTimeToFirstByteMs: z.number(),
        FirewallMatchesActions: z.array(z.any()),
        FirewallMatchesRuleIDs: z.array(z.any()),
        FirewallMatchesSources: z.array(z.any()),
        OriginDNSResponseTimeMs: z.number(),
        OriginIP: z.string(),
        OriginRequestHeaderSendDurationMs: z.number(),
        OriginResponseBytes: z.number(),
        OriginResponseDurationMs: z.number(),
        OriginResponseHTTPExpires: z.string(),
        OriginResponseHTTPLastModified: z.string(),
        OriginResponseHeaderReceiveDurationMs: z.number(),
        OriginResponseStatus: z.number(),
        OriginResponseTime: z.number(),
        OriginSSLProtocol: z.string(),
        OriginTCPHandshakeDurationMs: z.number(),
        OriginTLSHandshakeDurationMs: z.number(),
        ParentRayID: z.string(),
        RequestHeaders: this.SCHEMA_REQUEST_HEADERS,
        ResponseHeaders: this.SCHEMA_RESPONSE_HEADERS,
        SecurityAction: z.string().optional(),
        SecurityActions: z.array(z.string()).optional(),
        SecurityLevel: z.string(),
        SecurityRuleDescription: z.string().optional(),
        SecurityRuleID: z.string().optional(),
        SecurityRuleIDs: z.array(z.string()).optional(),
        SecuritySources: z.array(z.string()).optional(),
        SmartRouteColoID: z.number(),
        UpperTierColoID: z.number(),
        // WAFAction: z.string(),
        // WAFAttackScore: z.number().optional(),
        // WAFFlags: z.string(),
        // WAFMatchedVar: z.string(),
        // WAFProfile: z.string(),
        // WAFRCEAttackScore: z.number().optional(),
        // WAFRuleID: z.string(),
        // WAFRuleMessage: z.string(),
        // WAFSQLiAttackScore: z.number().optional(),
        // WAFXSSAttackScore: z.number().optional(),
        WorkerCPUTime: z.number(),
        WorkerStatus: z.string(),
        WorkerSubrequest: z.boolean(),
        WorkerSubrequestCount: z.number(),
        ZoneID: z.number().optional(),
        ZoneName: z.string(),
        CacheReserveUsed: z.boolean(),
        WorkerWallTimeUs: z.number(),
    }).transform(o=>{
        const protocol = o.ClientSSLProtocol.split("v");
        return {
            client: {
                asn: o.ClientASN,
                country: o.ClientCountry,
                device: {
                    type: o.ClientDeviceType,
                },
                ip: {
                    value: o.ClientIP,
                    class: o.ClientIPClass,
                },
                mtls: o.ClientMTLSAuthStatus!="unknown"?{
                    auth: {
                        cert: {
                            fingerprint: o.ClientMTLSAuthCertFingerprint,
                        },
                        status: o.ClientMTLSAuthStatus,
                    },
                }:undefined,
                region: o.ClientRegionCode,
                request: {
                    bytes: o.ClientRequestBytes,
                    host: o.ClientRequestHost,
                    method: o.ClientRequestMethod,
                    path: o.ClientRequestPath,
                    protocol: o.ClientRequestProtocol,
                    referer: o.ClientRequestReferer.length>0?o.ClientRequestReferer:undefined,
                    scheme: o.ClientRequestScheme,
                    source: o.ClientRequestSource,
                    ua: o.ClientRequestUserAgent,
                    uri: o.ClientRequestURI,
                },
                ssl: o.ClientSSLCipher!="NONE"?{
                    cipher: o.ClientSSLCipher,
                    protocol: protocol[0],
                    version: protocol[1],
                }:undefined,
                src: o.ClientSrcPort>0?{
                    port: o.ClientSrcPort,
                }:undefined,
                tcp: o.ClientTCPRTTMs>0?{
                    rtt: o.ClientTCPRTTMs,
                }:undefined,
                x: o.ClientXRequestedWith.length>0?{
                    requestedWith: o.ClientXRequestedWith,
                }:undefined,
            },
            edge: {
                cf: {
                    connectingO2O: o.EdgeCFConnectingO2O,
                },
                colo: {
                    code: o.EdgeColoCode,
                    id: o.EdgeColoID,
                },
                pathing: {
                    op: o.EdgePathingOp,
                    src: o.EdgePathingSrc,
                    status: o.EdgePathingStatus,
                },
                rateLimit: o.EdgeRateLimitAction.length>0 && o.EdgeRateLimitID!=0?{
                    action: o.EdgeRateLimitAction,
                    id: o.EdgeRateLimitID,
                }:undefined,
                request: {
                    host: o.EdgeRequestHost,
                },
                response: {
                    body: {
                        bytes: o.EdgeResponseBodyBytes,
                    },
                    bytes: o.EdgeResponseBytes,
                    compression: {
                        ratio: o.EdgeResponseCompressionRatio,
                    },
                    contentType: o.EdgeResponseContentType,
                    status: o.EdgeResponseStatus,
                },
                ray: o.RayID,
                server: o.EdgeServerIP.length>0?{
                    ip: o.EdgeServerIP,
                }:undefined,
                time2FirstByte: o.EdgeTimeToFirstByteMs,
                timestamp: {
                    start: o.EdgeStartTimestamp,
                    end: o.EdgeEndTimestamp,
                },
            },
            cache: {
                reserve: {
                    used: o.CacheReserveUsed,
                },
                response: {
                    bytes: o.CacheResponseBytes,
                    status: o.CacheResponseStatus,
                },
                status: o.CacheCacheStatus,
                tiered: {
                    fill: o.CacheTieredFill,
                },
            },
            cookies: o.Cookies,
            content: o.ContentScanObjResults!=undefined && o.ContentScanObjResults.length>0 && o.ContentScanObjTypes!=undefined && o.ContentScanObjTypes.length>0?{
                scan: {
                    results: o.ContentScanObjResults.length>0?o.ContentScanObjResults:undefined,
                    types: o.ContentScanObjTypes.length>0?o.ContentScanObjTypes:undefined,
                },
            }:undefined,
            firewall: o.FirewallMatchesActions.length>0 && o.FirewallMatchesRuleIDs.length>0 && o.FirewallMatchesSources.length>0?{
                matches: {
                    actions: o.FirewallMatchesActions.length>0?o.FirewallMatchesActions:undefined,
                    ruleIDs: o.FirewallMatchesRuleIDs.length>0?o.FirewallMatchesRuleIDs:undefined,
                    sources: o.FirewallMatchesSources.length>0?o.FirewallMatchesSources:undefined,
                },
            }:undefined,
            origin: o.OriginIP.length>0?{
                dns: {
                    response: {
                        time: o.OriginDNSResponseTimeMs,
                    },
                },
                ip: o.OriginIP,
                request: {
                    header: {
                        send: {
                            duration: o.OriginRequestHeaderSendDurationMs,
                        },
                    },
                },
                response: {
                    bytes: o.OriginResponseBytes,
                    duration: o.OriginResponseDurationMs,
                    header: {
                        receive: {
                            duration: o.OriginResponseHeaderReceiveDurationMs,
                        },
                    },
                    http: {
                        expires: o.OriginResponseHTTPExpires,
                        lastModified: o.OriginResponseHTTPLastModified,
                    },
                    status: o.OriginResponseStatus,
                    time: o.OriginResponseTime,
                },
                ssl: {
                    protocol: o.OriginSSLProtocol,
                },
                tcp: {
                    handshake: {
                        duration: o.OriginTCPHandshakeDurationMs,
                    },
                },
                tls: {
                    handshake: {
                        duration: o.OriginTLSHandshakeDurationMs,
                    },
                },
            }:undefined,
            parent: {
                ray: o.ParentRayID,
            },
            request: {
                headers: o.RequestHeaders,
            },
            response: {
                headers: o.ResponseHeaders,
            },
            security: o.SecurityAction!=undefined && o.SecurityAction.length>0?{
                action: o.SecurityAction,
                actions: o.SecurityActions,
                level: o.SecurityLevel,
                rule: {
                    description: o.SecurityRuleDescription,
                    id: o.SecurityRuleID,
                    ids: o.SecurityRuleIDs,
                },
                sources: o.SecuritySources,
            }:undefined,
            smart: o.SmartRouteColoID>0?{
                route: {
                    colo: o.SmartRouteColoID,
                },
            }:undefined,
            upper: o.UpperTierColoID>0?{
                tier: {
                    colo: o.UpperTierColoID,
                },
            }:undefined,
            // waf: o.WAFAction!="unknown"?{
            //     action: o.WAFAction,
            //     flags: o.WAFFlags,
            //     matched: {
            //         var: o.WAFMatchedVar,
            //     },
            //     profile: o.WAFProfile,
            //     rce: {
            //         score: o.WAFRCEAttackScore,
            //     },
            //     rule: {
            //         id: o.WAFRuleID,
            //         message: o.WAFRuleMessage,
            //     },
            //     score: o.WAFAttackScore,
            //     sqli: {
            //         score: o.WAFSQLiAttackScore,
            //     },
            //     xss: {
            //         score: o.WAFXSSAttackScore,
            //     },
            // }:undefined,
            worker: o.WorkerStatus!="unknown"?{
                cpu: {
                    time: o.WorkerCPUTime,
                },
                status: o.WorkerStatus,
                subrequest: {
                    count: o.WorkerSubrequestCount,
                },
                wall: {
                    time: o.WorkerWallTimeUs,
                },
            }:undefined,
            zone: {
                id: o.ZoneID,
                name: o.ZoneName,
            },
        };
    });

    public static async getIDX(cliente: Cliente, source: string): Promise<number|undefined> {
        const hits = await elastic.search<{metadata: {idx: number}}>({
            index: Registro.getIndex(cliente.id),
            query: {
                term: {
                    "metadata.source": source,
                },
            },
            sort: [
                {
                    "metadata.idx": "desc",
                },
            ],
            size: 1,
            _source: [
                "metadata.idx",
            ],
        });

        return hits.hits.hits[0]?._source?.metadata.idx;
    }

    public static async ingest(telemetry: Telemetry, storage: Storage, idx?: number): Promise<void> {
        let memoryOK = false;
        while (process.memoryUsage().heapUsed > 3 * 1024*1024*1024) {
            if (!memoryOK) {
                info("Esperando por memoria");
                memoryOK = true;
            }
            await PromiseDelayed(Math.floor(Math.random()*1000));
        }
        if (memoryOK) {
            info("Memoria OK");
        }

        telemetry.initTimer();

        const lector = readline.createInterface({
            input: storage.stream,
            crlfDelay: Infinity,
            terminal: false,
        });

        const bulk = Bulk.init(elastic, {
            // blockSize: 25000,
            index: Registro.getIndex(telemetry.proyecto),
            refresh: false,
        });

        idx ??=-1;
        for await (const linea of lector) {
            if (linea.length==0) {
                // en este caso no nos saltamos linea de telemetría, ignoramos las lineas vacías tal como puede ser la de final de archivo
                continue;
            }
            if (idx>=telemetry.records) {
                telemetry.saltar();
                continue;
            }

            const cf: IRAWData = Cloudflare.SCHEMA.parse(JSON.parse(linea.trim()));
            if (this.FILTRAR_PATHS_PREFIX.some(path=>cf.client.request.path.startsWith(path))) {
                telemetry.saltar();
                continue;
            }

            bulk.create({doc: Registro.build(cf, telemetry).toJSON()});
        }

        await bulk.run();

        telemetry.endTimer();
    }
}
