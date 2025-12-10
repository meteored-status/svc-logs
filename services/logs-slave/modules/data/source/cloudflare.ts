import readline from "node:readline/promises";
import {BigQuery} from "@google-cloud/bigquery";
import {z} from "zod";

import {arrayChop} from "services-comun/modules/utiles/array";
import {error, info} from "services-comun/modules/utiles/log";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {Storage} from "services-comun/modules/fs/storage";

import {type IRAWData, type IRegistroES, Registro} from "../registro";
import {Cliente} from "../cliente";

const SCHEMA_COOKIES = z.object({
    "cf-access-user": z.string().optional(),
}).transform(o=>({
    "user": o["cf-access-user"],
}));

const SCHEMA_REQUEST_HEADERS = z.object({
    "x-api-key": z.string().optional(),
}).transform(o=>({
    apiKey: o["x-api-key"],
}));

const SCHEMA_RESPONSE_HEADERS = z.object({
    "x-meteored-node": z.string().optional(),
    "x-meteored-service": z.string().optional(),
    "x-meteored-version": z.string().optional(),
}).transform(o=>({
    node: o["x-meteored-node"],
    service: o["x-meteored-service"],
    version: o["x-meteored-version"],
}));

export default z.object({
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
    CacheCacheStatus: z.string(),
    CacheTieredFill: z.boolean(),
    ClientCountry: z.string(),
    ClientDeviceType: z.string(),
    ClientIPClass: z.string(),
    ClientRegionCode: z.string().optional(),
    ClientRequestPath: z.string(),
    ClientRequestProtocol: z.string(),
    ClientRequestReferer: z.string(),
    ClientRequestScheme: z.string(),
    ClientRequestSource: z.string(),
    ClientRequestUserAgent: z.string(),
    Cookies: SCHEMA_COOKIES,
    EdgeRequestHost: z.string(),
    EdgeResponseContentType: z.string(),
    OriginIP: z.string(),
    OriginResponseDurationMs: z.number(),
    RequestHeaders: SCHEMA_REQUEST_HEADERS,
    ResponseHeaders: SCHEMA_RESPONSE_HEADERS,
    VerifiedBotCategory: z.string(),
    WorkerSubrequest: z.boolean(),
    ZoneName: z.string(),
    CacheReserveUsed: z.boolean(),
}).transform(o=>{
    return {
        client: {
            bot: o.VerifiedBotCategory.length>0,
            country: o.ClientCountry,
            device: {
                type: o.ClientDeviceType,
            },
            ip: {
                value: o.ClientIP,
                class: o.ClientIPClass,
            },
            region: o.ClientRegionCode,
            request: {
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
        },
        edge: {
            request: {
                host: o.EdgeRequestHost,
            },
            response: {
                contentType: o.EdgeResponseContentType,
                status: o.EdgeResponseStatus,
            },
            timestamp: {
                start: o.EdgeStartTimestamp,
            },
        },
        cache: {
            reserve: {
                used: o.CacheReserveUsed,
            },
            status: o.CacheCacheStatus,
            tiered: {
                fill: o.CacheTieredFill,
            },
        },
        cookies: o.Cookies,
        origin: o.OriginIP.length>0?{
            ip: o.OriginIP,
            response: {
                duration: o.OriginResponseDurationMs,
            },
        }:undefined,
        request: {
            headers: o.RequestHeaders,
        },
        response: {
            headers: o.ResponseHeaders,
        },
        zone: {
            name: o.ZoneName,
        },
    };
});
