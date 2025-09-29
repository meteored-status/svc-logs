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
        CacheResponseBytes: z.number().optional(),
        CacheResponseStatus: z.number().optional(),
        CacheTieredFill: z.boolean(),
        ClientASN: z.number().optional(),
        ClientCountry: z.string().optional(),
        ClientDeviceType: z.string().optional(),
        ClientIPClass: z.string(),
        ClientMTLSAuthCertFingerprint: z.string().optional(),
        ClientMTLSAuthStatus: z.string().optional(),
        ClientRegionCode: z.string().optional(),
        ClientRequestBytes: z.number().optional(),
        ClientRequestPath: z.string(),
        ClientRequestProtocol: z.string(),
        ClientRequestReferer: z.string(),
        ClientRequestScheme: z.string(),
        ClientRequestSource: z.string().optional(),
        ClientRequestUserAgent: z.string(),
        ClientSSLCipher: z.string().optional(),
        ClientSSLProtocol: z.string().optional(),
        ClientSrcPort: z.number().optional(),
        ClientTCPRTTMs: z.number().optional(),
        ClientXRequestedWith: z.string().optional(),
        Cookies: this.SCHEMA_COOKIES,
        ContentScanObjResults: z.array(z.string()).optional(),
        ContentScanObjTypes: z.array(z.string()).optional(),
        EdgeCFConnectingO2O: z.boolean().optional(),
        EdgeColoCode: z.string().optional(),
        EdgeColoID: z.number().optional(),
        EdgePathingOp: z.string().optional(),
        EdgePathingSrc: z.string().optional(),
        EdgePathingStatus: z.string().optional(),
        EdgeRateLimitAction: z.string().optional(),
        EdgeRateLimitID: z.number().optional(),
        EdgeRequestHost: z.string(),
        EdgeResponseBodyBytes: z.number().optional(),
        EdgeResponseCompressionRatio: z.number().optional(),
        EdgeResponseContentType: z.string().optional(),
        EdgeServerIP: z.string(),
        EdgeTimeToFirstByteMs: z.number().optional(),
        FirewallMatchesActions: z.array(z.any()).optional(),
        FirewallMatchesRuleIDs: z.array(z.any()).optional(),
        FirewallMatchesSources: z.array(z.any()).optional(),
        OriginDNSResponseTimeMs: z.number().optional(),
        OriginIP: z.string().optional(),
        OriginRequestHeaderSendDurationMs: z.number().optional(),
        OriginResponseBytes: z.number().optional(),
        OriginResponseDurationMs: z.number().optional(),
        OriginResponseHTTPExpires: z.string(),
        OriginResponseHTTPLastModified: z.string().optional(),
        OriginResponseHeaderReceiveDurationMs: z.number().optional(),
        OriginResponseStatus: z.number().optional(),
        OriginResponseTime: z.number().optional(),
        OriginSSLProtocol: z.string().optional(),
        OriginTCPHandshakeDurationMs: z.number().optional(),
        OriginTLSHandshakeDurationMs: z.number().optional(),
        ParentRayID: z.string().optional(),
        RequestHeaders: this.SCHEMA_REQUEST_HEADERS,
        // ResponseHeaders: this.SCHEMA_RESPONSE_HEADERS,
        SecurityAction: z.string().optional(),
        SecurityActions: z.array(z.string()).optional(),
        SecurityLevel: z.string().optional(),
        SecurityRuleDescription: z.string().optional(),
        SecurityRuleID: z.string().optional(),
        SecurityRuleIDs: z.array(z.string()).optional(),
        SecuritySources: z.array(z.string()).optional(),
        SmartRouteColoID: z.number().optional(),
        UpperTierColoID: z.number().optional(),
        WAFAction: z.string().optional(),
        WAFAttackScore: z.number().optional(),
        WAFFlags: z.string().optional(),
        WAFMatchedVar: z.string().optional(),
        WAFProfile: z.string().optional(),
        WAFRCEAttackScore: z.number().optional(),
        WAFRuleID: z.string().optional(),
        WAFRuleMessage: z.string().optional(),
        WAFSQLiAttackScore: z.number().optional(),
        WAFXSSAttackScore: z.number().optional(),
        WorkerCPUTime: z.number().optional(),
        WorkerStatus: z.string(),
        WorkerSubrequest: z.boolean(),
        WorkerSubrequestCount: z.number(),
        ZoneID: z.number().optional(),
        ZoneName: z.string().optional(),
        CacheReserveUsed: z.boolean(),
        WorkerWallTimeUs: z.number().optional(),
    }).transform(o=>{
        const protocol = o.ClientSSLProtocol?.split("v") ?? [];
        return {
            client: {
                asn: o.ClientASN,
                country: o.ClientCountry,
                device: o.ClientDeviceType!=undefined ? {
                    type: o.ClientDeviceType,
                } : undefined,
                ip: {
                    value: o.ClientIP,
                    class: o.ClientIPClass,
                },
                mtls: o.ClientMTLSAuthCertFingerprint!=undefined || o.ClientMTLSAuthStatus!="unknown" ? {
                    auth: o.ClientMTLSAuthCertFingerprint!=undefined || o.ClientMTLSAuthStatus!=undefined ? {
                        cert: o.ClientMTLSAuthCertFingerprint!=undefined ? {
                            fingerprint: o.ClientMTLSAuthCertFingerprint,
                        } : undefined,
                        status: o.ClientMTLSAuthStatus,
                    } : undefined,
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
                ssl: o.ClientSSLCipher!=undefined && o.ClientSSLCipher!="NONE" ? {
                    cipher: o.ClientSSLCipher,
                    protocol: protocol[0],
                    version: protocol[1],
                }:undefined,
                src: o.ClientSrcPort!=undefined && o.ClientSrcPort>0 ? {
                    port: o.ClientSrcPort,
                } : undefined,
                tcp: o.ClientTCPRTTMs!=undefined && o.ClientTCPRTTMs>0?{
                    rtt: o.ClientTCPRTTMs,
                }:undefined,
                x: o.ClientXRequestedWith!=undefined && o.ClientXRequestedWith.length>0?{
                    requestedWith: o.ClientXRequestedWith,
                }:undefined,
            },
            edge: {
                cf: o.EdgeCFConnectingO2O!=undefined ? {
                    connectingO2O: o.EdgeCFConnectingO2O,
                }: undefined,
                colo: o.EdgeColoCode!=undefined || o.EdgeColoID!=undefined ? {
                    code: o.EdgeColoCode,
                    id: o.EdgeColoID,
                } : undefined,
                pathing: o.EdgePathingOp!=undefined || o.EdgePathingSrc!=undefined || o.EdgePathingStatus!=undefined ? {
                    op: o.EdgePathingOp,
                    src: o.EdgePathingSrc,
                    status: o.EdgePathingStatus,
                } : undefined,
                rateLimit: o.EdgeRateLimitAction!=undefined && o.EdgeRateLimitAction.length>0 && o.EdgeRateLimitID!=undefined && o.EdgeRateLimitID!=0?{
                    action: o.EdgeRateLimitAction,
                    id: o.EdgeRateLimitID,
                }:undefined,
                request: {
                    host: o.EdgeRequestHost,
                },
                response: {
                    body: o.EdgeResponseBodyBytes!=undefined ? {
                        bytes: o.EdgeResponseBodyBytes,
                    } : undefined,
                    bytes: o.EdgeResponseBytes,
                    compression: o.EdgeResponseCompressionRatio!=undefined ? {
                        ratio: o.EdgeResponseCompressionRatio,
                    } : undefined,
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
                response: o.CacheResponseBytes!=undefined || o.CacheResponseStatus!=undefined ? {
                    bytes: o.CacheResponseBytes,
                    status: o.CacheResponseStatus,
                }: undefined,
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
            firewall: o.FirewallMatchesActions!=undefined && o.FirewallMatchesActions.length>0 && o.FirewallMatchesRuleIDs!=undefined && o.FirewallMatchesRuleIDs.length>0 && o.FirewallMatchesSources!=undefined && o.FirewallMatchesSources.length>0?{
                matches: {
                    actions: o.FirewallMatchesActions.length>0?o.FirewallMatchesActions:undefined,
                    ruleIDs: o.FirewallMatchesRuleIDs.length>0?o.FirewallMatchesRuleIDs:undefined,
                    sources: o.FirewallMatchesSources.length>0?o.FirewallMatchesSources:undefined,
                },
            }:undefined,
            origin: o.OriginIP!=undefined && length>0?{
                dns: o.OriginDNSResponseTimeMs!=undefined ? {
                    response: o.OriginDNSResponseTimeMs!=undefined ? {
                        time: o.OriginDNSResponseTimeMs,
                    }: undefined,
                }: undefined,
                ip: o.OriginIP,
                request: o.OriginRequestHeaderSendDurationMs!=undefined ? {
                    header: o.OriginRequestHeaderSendDurationMs!=undefined ? {
                        send: o.OriginRequestHeaderSendDurationMs!=undefined ? {
                            duration: o.OriginRequestHeaderSendDurationMs,
                        } : undefined,
                    } : undefined,
                } : undefined,
                response: {
                    bytes: o.OriginResponseBytes,
                    duration: o.OriginResponseDurationMs,
                    header: o.OriginResponseHeaderReceiveDurationMs!=undefined ? {
                        receive: o.OriginResponseHeaderReceiveDurationMs!=undefined ? {
                            duration: o.OriginResponseHeaderReceiveDurationMs,
                        } : undefined,
                    } : undefined,
                    http: {
                        expires: o.OriginResponseHTTPExpires,
                        lastModified: o.OriginResponseHTTPLastModified,
                    },
                    status: o.OriginResponseStatus,
                    time: o.OriginResponseTime,
                },
                ssl: o.OriginSSLProtocol!=undefined ? {
                    protocol: o.OriginSSLProtocol,
                } : undefined,
                tcp: o.OriginTCPHandshakeDurationMs!=undefined ? {
                    handshake: o.OriginTCPHandshakeDurationMs!=undefined ? {
                        duration: o.OriginTCPHandshakeDurationMs,
                    } : undefined,
                } : undefined,
                tls: o.OriginTLSHandshakeDurationMs!=undefined ? {
                    handshake: o.OriginTLSHandshakeDurationMs!=undefined ? {
                        duration: o.OriginTLSHandshakeDurationMs,
                    } : undefined,
                } : undefined,
            }:undefined,
            parent: o.ParentRayID!=undefined ? {
                ray: o.ParentRayID,
            } : undefined,
            request: {
                headers: o.RequestHeaders,
            },
            // response: {
            //     headers: o.ResponseHeaders,
            // },
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
            smart: o.SmartRouteColoID!=undefined && o.SmartRouteColoID>0 ? {
                route: {
                    colo: o.SmartRouteColoID,
                },
            }:undefined,
            upper: o.UpperTierColoID!=undefined && o.UpperTierColoID>0 ? {
                tier: {
                    colo: o.UpperTierColoID,
                },
            }:undefined,
            waf: o.WAFAction!=undefined && o.WAFAction!="unknown" || o.WAFProfile!=undefined ? {
                action: o.WAFAction,
                flags: o.WAFFlags,
                matched: {
                    var: o.WAFMatchedVar,
                },
                profile: o.WAFProfile,
                rce: {
                    score: o.WAFRCEAttackScore,
                },
                rule: o.WAFRuleID!=undefined || o.WAFRuleMessage!=undefined ? {
                    id: o.WAFRuleID,
                    message: o.WAFRuleMessage,
                } : undefined,
                score: o.WAFAttackScore,
                sqli: {
                    score: o.WAFSQLiAttackScore,
                },
                xss: {
                    score: o.WAFXSSAttackScore,
                },
            }:undefined,
            worker: o.WorkerStatus!="unknown"?{
                cpu: o.WorkerCPUTime!=undefined ? {
                    time: o.WorkerCPUTime,
                } : undefined,
                status: o.WorkerStatus,
                subrequest: {
                    count: o.WorkerSubrequestCount,
                },
                wall: o.WorkerWallTimeUs!=undefined ? {
                    time: o.WorkerWallTimeUs,
                } : undefined,
            }:undefined,
            zone: o.ZoneID!=undefined && o.ZoneName!=undefined ? {
                id: o.ZoneID,
                name: o.ZoneName,
            } : undefined,
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
