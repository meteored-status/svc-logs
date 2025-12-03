import readline from "node:readline/promises";
import {BigQuery} from "@google-cloud/bigquery";
import {z} from "zod";

import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {Storage} from "services-comun/modules/fs/storage";
import {error, info} from "services-comun/modules/utiles/log";

import {type IRAWData, type IRegistroES, Registro} from "../registro/";
import type {Telemetry} from "../telemetry";
import {arrayChop} from "services-comun/modules/utiles/array";

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
        // "cache-tags": z.string().optional(),
        // etag: z.string().optional(),
        // expires: z.coerce.date().optional(),
        // "last-modified": z.coerce.date().optional(),
        "x-meteored-node": z.string().optional(),
        // "x-meteored-node-chain": z.string().optional(),
        "x-meteored-service": z.string().optional(),
        "x-meteored-version": z.string().optional(),
        // "x-meteored-zone": z.string().optional(),
    }).transform(o=>({
        // tags: o["cache-tags"]!=undefined?o["cache-tags"].split(","):undefined,
        // etag: o.etag,
        // expires: o.expires!=undefined?new Date(o.expires):undefined,
        // lastModified: o["last-modified"],
        // mr: {
        //     chain: o["x-meteored-node-chain"]!=undefined?o["x-meteored-node-chain"].split(","):undefined,
        node: o["x-meteored-node"],
        service: o["x-meteored-service"],
        version: o["x-meteored-version"],
        //     zone: o["x-meteored-zone"],
        // },
    }));

    private static readonly SCHEMA = z.object({
        ClientIP: z.string(),
        ClientRequestHost: z.string(),
        ClientRequestMethod: z.string(),
        ClientRequestURI: z.string(),
        EdgeEndTimestamp: z.union([z.string(), z.number()]).optional()
            .transform(o=>{
                if (o===undefined) {
                    return undefined;
                }
                if (typeof o === "number") {
                    return new Date(Math.floor(o/1000000));
                }
                return new Date(o);
            }),
        // EdgeResponseBytes: z.number().optional(),
        EdgeResponseStatus: z.number(),
        EdgeStartTimestamp: z.union([z.string(), z.number()])
            .transform(o=>{
                if (typeof o === "number") {
                    return new Date(Math.floor(o/1000000));
                }
                return new Date(o);
            }),
        RayID: z.string().optional(), // todo para quitar
        CacheCacheStatus: z.string(),
        // CacheResponseBytes: z.number().optional(),
        // CacheResponseStatus: z.number().optional(),
        CacheTieredFill: z.boolean(),
        ClientASN: z.number().optional(), // todo para quitar
        ClientCountry: z.string(),
        ClientDeviceType: z.string(),
        ClientIPClass: z.string(),
        ClientMTLSAuthCertFingerprint: z.string().optional(), // todo para quitar
        ClientMTLSAuthStatus: z.string().optional(), // todo para quitar
        ClientRegionCode: z.string().optional(),
        // ClientRequestBytes: z.number().optional(),
        ClientRequestPath: z.string(),
        ClientRequestProtocol: z.string(),
        ClientRequestReferer: z.string(),
        ClientRequestScheme: z.string(),
        ClientRequestSource: z.string(),
        ClientRequestUserAgent: z.string(),
        // ClientSSLCipher: z.string().optional(),
        // ClientSSLProtocol: z.string().optional(),
        ClientSrcPort: z.number().optional(), // todo para quitar
        ClientTCPRTTMs: z.number().optional(), // todo para quitar
        ClientXRequestedWith: z.string().optional(), // todo para quitar
        Cookies: this.SCHEMA_COOKIES,
        ContentScanObjResults: z.array(z.string()).optional(), // todo para quitar
        ContentScanObjTypes: z.array(z.string()).optional(), // todo para quitar
        EdgeCFConnectingO2O: z.boolean().optional(), // todo para quitar
        EdgeColoCode: z.string().optional(), // todo para quitar
        EdgeColoID: z.number().optional(), // todo para quitar
        EdgePathingOp: z.string().optional(), // todo para quitar
        EdgePathingSrc: z.string().optional(), // todo para quitar
        EdgePathingStatus: z.string().optional(), // todo para quitar
        // EdgeRateLimitAction: z.string(),
        // EdgeRateLimitID: z.number(),
        EdgeRequestHost: z.string(),
        // EdgeResponseBodyBytes: z.number().optional(),
        // EdgeResponseCompressionRatio: z.number().optional(),
        EdgeResponseContentType: z.string(),
        EdgeServerIP: z.string().optional(), // todo para quitar
        // EdgeTimeToFirstByteMs: z.number().optional(),
        // FirewallMatchesActions: z.array(z.any()),
        // FirewallMatchesRuleIDs: z.array(z.any()),
        // FirewallMatchesSources: z.array(z.any()),
        // OriginDNSResponseTimeMs: z.number().optional(),
        OriginIP: z.string(),
        // OriginRequestHeaderSendDurationMs: z.number().optional(),
        OriginResponseBytes: z.number().optional(), // todo para quitar
        OriginResponseDurationMs: z.number(),
        OriginResponseHTTPExpires: z.string().optional(), // todo para quitar
        OriginResponseHTTPLastModified: z.string().optional(), // todo para quitar
        // OriginResponseHeaderReceiveDurationMs: z.number().optional(),
        OriginResponseStatus: z.number().optional(), // todo para quitar
        OriginResponseTime: z.number().optional(), // todo para quitar
        OriginSSLProtocol: z.string().optional(), // todo para quitar
        OriginTCPHandshakeDurationMs: z.number().optional(), // todo para quitar
        OriginTLSHandshakeDurationMs: z.number().optional(), // todo para quitar
        ParentRayID: z.string().optional(), // todo para quitar
        RequestHeaders: this.SCHEMA_REQUEST_HEADERS,
        ResponseHeaders: this.SCHEMA_RESPONSE_HEADERS,
        // SecurityAction: z.string().optional(),
        // SecurityActions: z.array(z.string()).optional(),
        // SecurityLevel: z.string(),
        // SecurityRuleDescription: z.string().optional(),
        // SecurityRuleID: z.string().optional(),
        // SecurityRuleIDs: z.array(z.string()).optional(),
        // SecuritySources: z.array(z.string()).optional(),
        SmartRouteColoID: z.number().optional(), // todo para quitar
        UpperTierColoID: z.number().optional(), // todo para quitar
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
        WorkerCPUTime: z.number().optional(), // todo para quitar
        WorkerStatus: z.string().optional(), // todo para quitar
        WorkerSubrequest: z.boolean(),
        WorkerSubrequestCount: z.number().optional(), // todo para quitar
        ZoneID: z.number().optional(), // todo para quitar
        ZoneName: z.string(),
        CacheReserveUsed: z.boolean(),
        WorkerWallTimeUs: z.number().optional(), // todo para quitar
    }).transform(o=>{
        // const protocol = o.ClientSSLProtocol.split("v");
        return {
            client: {
                // asn: o.ClientASN,
                country: o.ClientCountry,
                device: {
                    type: o.ClientDeviceType,
                },
                ip: {
                    value: o.ClientIP,
                    class: o.ClientIPClass,
                },
                // mtls: o.ClientMTLSAuthStatus!="unknown"?{
                //     auth: {
                //         cert: {
                //             fingerprint: o.ClientMTLSAuthCertFingerprint,
                //         },
                //         status: o.ClientMTLSAuthStatus,
                //     },
                // }:undefined,
                region: o.ClientRegionCode,
                request: {
                    // bytes: o.ClientRequestBytes,
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
                // ssl: o.ClientSSLCipher!="NONE"?{
                //     cipher: o.ClientSSLCipher,
                //     protocol: protocol[0],
                //     version: protocol[1],
                // }:undefined,
                // src: o.ClientSrcPort>0?{
                //     port: o.ClientSrcPort,
                // }:undefined,
                // tcp: o.ClientTCPRTTMs>0?{
                //     rtt: o.ClientTCPRTTMs,
                // }:undefined,
                // x: o.ClientXRequestedWith.length>0?{
                //     requestedWith: o.ClientXRequestedWith,
                // }:undefined,
            },
            edge: {
                // cf: {
                //     connectingO2O: o.EdgeCFConnectingO2O,
                // },
                // colo: {
                //     code: o.EdgeColoCode,
                //     id: o.EdgeColoID,
                // },
                // pathing: {
                //     op: o.EdgePathingOp,
                //     src: o.EdgePathingSrc,
                //     status: o.EdgePathingStatus,
                // },
                // rateLimit: o.EdgeRateLimitAction.length>0 && o.EdgeRateLimitID!=0?{
                //     action: o.EdgeRateLimitAction,
                //     id: o.EdgeRateLimitID,
                // }:undefined,
                request: {
                    host: o.EdgeRequestHost,
                },
                response: {
                    // body: {
                    //     bytes: o.EdgeResponseBodyBytes,
                    // },
                    // bytes: o.EdgeResponseBytes,
                    // compression: {
                    //     ratio: o.EdgeResponseCompressionRatio,
                    // },
                    contentType: o.EdgeResponseContentType,
                    status: o.EdgeResponseStatus,
                },
                // ray: o.RayID,
                // server: o.EdgeServerIP.length>0?{
                //     ip: o.EdgeServerIP,
                // }:undefined,
                // time2FirstByte: o.EdgeTimeToFirstByteMs,
                timestamp: {
                    start: o.EdgeStartTimestamp,
                //     end: o.EdgeEndTimestamp,
                },
            },
            cache: {
                reserve: {
                    used: o.CacheReserveUsed,
                },
                // response: {
                //     bytes: o.CacheResponseBytes,
                //     status: o.CacheResponseStatus,
                // },
                status: o.CacheCacheStatus,
                tiered: {
                    fill: o.CacheTieredFill,
                },
            },
            cookies: o.Cookies,
            // content: o.ContentScanObjResults!=undefined && o.ContentScanObjResults.length>0 && o.ContentScanObjTypes!=undefined && o.ContentScanObjTypes.length>0?{
            //     scan: {
            //         results: o.ContentScanObjResults.length>0?o.ContentScanObjResults:undefined,
            //         types: o.ContentScanObjTypes.length>0?o.ContentScanObjTypes:undefined,
            //     },
            // }:undefined,
            // firewall: o.FirewallMatchesActions.length>0 && o.FirewallMatchesRuleIDs.length>0 && o.FirewallMatchesSources.length>0?{
            //     matches: {
            //         actions: o.FirewallMatchesActions.length>0?o.FirewallMatchesActions:undefined,
            //         ruleIDs: o.FirewallMatchesRuleIDs.length>0?o.FirewallMatchesRuleIDs:undefined,
            //         sources: o.FirewallMatchesSources.length>0?o.FirewallMatchesSources:undefined,
            //     },
            // }:undefined,
            origin: o.OriginIP.length>0?{
                // dns: {
                //     response: {
                //         time: o.OriginDNSResponseTimeMs,
                //     },
                // },
                ip: o.OriginIP,
                // request: {
                //     header: {
                //         send: {
                //             duration: o.OriginRequestHeaderSendDurationMs,
                //         },
                //     },
                // },
                response: {
                    // bytes: o.OriginResponseBytes,
                    duration: o.OriginResponseDurationMs,
                    // header: {
                    //     receive: {
                    //         duration: o.OriginResponseHeaderReceiveDurationMs,
                    //     },
                    // },
                    // http: {
                    //     expires: o.OriginResponseHTTPExpires,
                    //     lastModified: o.OriginResponseHTTPLastModified,
                    // },
                    // status: o.OriginResponseStatus,
                    // time: o.OriginResponseTime,
                },
                // ssl: {
                //     protocol: o.OriginSSLProtocol,
                // },
                // tcp: {
                //     handshake: {
                //         duration: o.OriginTCPHandshakeDurationMs,
                //     },
                // },
                // tls: {
                //     handshake: {
                //         duration: o.OriginTLSHandshakeDurationMs,
                //     },
                // },
            }:undefined,
            // parent: {
            //     ray: o.ParentRayID,
            // },
            request: {
                headers: o.RequestHeaders,
            },
            response: {
                headers: o.ResponseHeaders,
            },
            // security: o.SecurityAction!=undefined && o.SecurityAction.length>0?{
            //     action: o.SecurityAction,
            //     actions: o.SecurityActions,
            //     level: o.SecurityLevel,
            //     rule: {
            //         description: o.SecurityRuleDescription,
            //         id: o.SecurityRuleID,
            //         ids: o.SecurityRuleIDs,
            //     },
            //     sources: o.SecuritySources,
            // }:undefined,
            // smart: o.SmartRouteColoID>0?{
            //     route: {
            //         colo: o.SmartRouteColoID,
            //     },
            // }:undefined,
            // upper: o.UpperTierColoID>0?{
            //     tier: {
            //         colo: o.UpperTierColoID,
            //     },
            // }:undefined,
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
            // worker: o.WorkerStatus!="unknown"?{
            //     cpu: {
            //         time: o.WorkerCPUTime,
            //     },
            //     status: o.WorkerStatus,
            //     subrequest: {
            //         count: o.WorkerSubrequestCount,
            //     },
            //     wall: {
            //         time: o.WorkerWallTimeUs,
            //     },
            // }:undefined,
            zone: {
                // id: o.ZoneID,
                name: o.ZoneName,
            },
        };
    });

    protected static BQ = new BigQuery({
        keyFilename: "files/credenciales/bigquery.json",
    });

    public static async ingest(telemetry: Telemetry, storage: Storage): Promise<void> {
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

        const buffer: IRegistroES[] = [];

        for await (const linea of lector) {
            if (linea.length==0) {
                // en este caso no nos saltamos linea de telemetría, ignoramos las lineas vacías tal como puede ser la de final de archivo
                continue;
            }

            const cf: IRAWData = Cloudflare.SCHEMA.parse(JSON.parse(linea.trim()));
            if (this.FILTRAR_PATHS_PREFIX.some(path=>cf.client.request.path.startsWith(path))) {
                telemetry.saltar();
                continue;
            }

            buffer.push(Registro.build(cf, telemetry).toJSON());
        }
        this.guardar(buffer).then(() => undefined);

        telemetry.endTimer();
    }

    private static async guardar(buffer: IRegistroES[]): Promise<void> {
        for (const chunk of arrayChop(buffer, 1000)) {
            await this.BQ.dataset("logs").table(`accesos`).insert(chunk)
                .catch((err) => {
                    error("Error guardando registros en BigQuery", JSON.stringify(err));
                });
        }
    }
}
