import readline from "node:readline/promises";

import {type INotify} from "services-comun-status/modules/services/logs-slave/backend";
import {IPodInfo} from "services-comun/modules/utiles/config";
import {Storage} from "services-comun/modules/fs/storage";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {error, info} from "services-comun/modules/utiles/log";
import bulk from "services-comun/modules/elasticsearch/bulk";
import elasticsearch from "services-comun/modules/elasticsearch/elastic";

import {ICliente} from "../bucket";
import {Registro} from "../registro";

export interface SourceCloudflare {
    ClientIP:                              string;
    ClientRequestHost:                     string;
    ClientRequestMethod:                   string;
    ClientRequestURI:                      string;
    ContentScanObjResults?:                string[];
    ContentScanObjTypes?:                  string[];
    EdgeEndTimestamp:                      Date;
    EdgeResponseBytes:                     number;
    EdgeResponseStatus:                    number;
    EdgeStartTimestamp:                    Date;
    RayID:                                 string;
    CacheCacheStatus:                      string;
    CacheResponseBytes:                    number;
    CacheResponseStatus:                   number;
    CacheTieredFill:                       boolean;
    ClientASN:                             number;
    ClientCountry:                         string;
    ClientDeviceType:                      string;
    ClientIPClass:                         string;
    ClientMTLSAuthCertFingerprint:         string;
    ClientMTLSAuthStatus:                  string;
    ClientRequestBytes:                    number;
    ClientRegionCode?:                     string;
    ClientRequestPath:                     string;
    ClientRequestProtocol:                 string;
    ClientRequestReferer:                  string;
    ClientRequestScheme:                   string;
    ClientRequestSource:                   string;
    ClientRequestUserAgent:                string;
    ClientSSLCipher:                       string;
    ClientSSLProtocol:                     string;
    ClientSrcPort:                         number;
    ClientTCPRTTMs:                        number;
    ClientXRequestedWith:                  string;
    Cookies:                               Cookies;
    EdgeCFConnectingO2O:                   boolean;
    EdgeColoCode:                          string;
    EdgeColoID:                            number;
    EdgePathingOp:                         string;
    EdgePathingSrc:                        string;
    EdgePathingStatus:                     string;
    EdgeRateLimitAction:                   string;
    EdgeRateLimitID:                       number;
    EdgeRequestHost:                       string;
    EdgeResponseBodyBytes:                 number;
    EdgeResponseCompressionRatio:          number;
    EdgeResponseContentType:               string;
    EdgeServerIP:                          string;
    EdgeTimeToFirstByteMs:                 number;
    FirewallMatchesActions:                any[];
    FirewallMatchesRuleIDs:                any[];
    FirewallMatchesSources:                any[];
    OriginDNSResponseTimeMs:               number;
    OriginIP:                              string;
    OriginRequestHeaderSendDurationMs:     number;
    OriginResponseBytes:                   number;
    OriginResponseDurationMs:              number;
    OriginResponseHTTPExpires:             string;
    OriginResponseHTTPLastModified:        string;
    OriginResponseHeaderReceiveDurationMs: number;
    OriginResponseStatus:                  number;
    OriginResponseTime:                    number;
    OriginSSLProtocol:                     string;
    OriginTCPHandshakeDurationMs:          number;
    OriginTLSHandshakeDurationMs:          number;
    ParentRayID:                           string;
    RequestHeaders:                        RequestHeaders;
    ResponseHeaders:                       ResponseHeaders;
    SecurityAction?:                       string;
    SecurityActions?:                      string[];
    SecurityLevel:                         string;
    SecurityRuleDescription?:              string;
    SecurityRuleID?:                       string;
    SecurityRuleIDs?:                      string[];
    SecuritySources?:                      string[];
    SmartRouteColoID:                      number;
    UpperTierColoID:                       number;
    WAFAction:                             string;
    WAFAttackScore?:                       number;
    WAFFlags:                              string;
    WAFMatchedVar:                         string;
    WAFProfile:                            string;
    WAFRCEAttackScore?:                    number;
    WAFRuleID:                             string;
    WAFRuleMessage:                        string;
    WAFSQLiAttackScore?:                   number;
    WAFXSSAttackScore?:                    number;
    WorkerCPUTime:                         number;
    WorkerStatus:                          string;
    WorkerSubrequest:                      boolean;
    WorkerSubrequestCount:                 number;
    ZoneID?:                               number;
    ZoneName:                              string;
    CacheReserveUsed:                      boolean;
    WorkerWallTimeUs:                      number;
}

export interface Cookies {
}

export interface RequestHeaders {
    "cf-access-user": string;
    "x-api-key": string;
}

export interface ResponseHeaders {
    "x-meteored-node":    string;
    "x-meteored-version": string;
    "x-meteored-zone":    string;
    expires:              string;
    etag:                 string;
    "last-modified":      string;
}

export class Cloudflare {
    /* STATIC */
    private static FILTRAR_PATHS_PREFIX: string[] = [
        "/cdn-cgi/"
    ];

    public static async ingest(pod: IPodInfo, cliente: ICliente, notify: INotify, storage: Storage, signal: AbortSignal, repesca: boolean): Promise<number> {
        let ok = true;
        signal.addEventListener("abort", ()=>{
            ok = false;
        }, {once: true});

        if (repesca) {
            const time = Date.now();
            // eliminar las entradas que coincidan con el mismo source antes de meter las nuevas para evitar duplicados
            const cantidad = await this.limpiarDuplicados(cliente, `gs://${notify.bucketId}/${notify.objectId}`);
            if (cantidad > 0) {
                info(`Limpiados ${cantidad} registros duplicados de ${cliente.id} - gs://${notify.bucketId}/${notify.objectId} en ${Date.now() - time}ms`);
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
                return Promise.reject("Abortado");
            }
            if (linea.length==0) {
                continue;
            }

            const registro = this.parse(linea.trim());
            if (registro==null) {
                continue;
            }

            if (this.FILTRAR_PATHS_PREFIX.some(prefix=>registro.ClientRequestURI.startsWith(prefix))) {
                continue;
            }

            promesas.push(this.ingestRegistro(pod, cliente, registro, notify, repesca));
            // await this.ingestRegistro(pod, cliente, registro, notify);
            lineas++;
        }
        // console.log(lineas, Date.now()-time);
        await Promise.all(promesas);

        return lineas;
    }

    private static async limpiarDuplicados(cliente: ICliente, source: string, retry=0): Promise<number> {
        try {
            const data = await elasticsearch.search({
                index: `logs-accesos-${cliente.id}`,
                query: {
                    term: {
                        "labels.source": source,
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

    private static async ingestRegistro(pod: IPodInfo, cliente: ICliente, raw: SourceCloudflare, notify: INotify, repesca: boolean): Promise<void> {
        const registro = await Registro.build(pod, cliente, raw, notify);
        await registro.save(repesca);
    }

    private static parse(json: string): SourceCloudflare|null {
        try {
            return cast(JSON.parse(json), r("SourceCloudflare"));
        } catch (e) {
            error("Cloudflare.parse", e);
            return null;
        }
    }

    // public static stringify(value: SourceCloudflare): string {
    //     return JSON.stringify(uncast(value, r("SourceCloudflare")), null, 2);
    // }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: string|number): any {
        if (val === null) {
            return null;
        }
        let d: Date;
        if (typeof val === "number") {
            d = new Date(Math.floor(val/1000000));
        } else {
            d = new Date(val);
        }
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
                : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
                    : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date) return transformDate(val);
    // if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "SourceCloudflare": o([
        { json: "ClientIP", js: "ClientIP", typ: "" },
        { json: "ClientRequestHost", js: "ClientRequestHost", typ: "" },
        { json: "ClientRequestMethod", js: "ClientRequestMethod", typ: "" },
        { json: "ClientRequestURI", js: "ClientRequestURI", typ: "" },
        { json: "EdgeEndTimestamp", js: "EdgeEndTimestamp", typ: Date },
        { json: "EdgeResponseBytes", js: "EdgeResponseBytes", typ: 0 },
        { json: "EdgeResponseStatus", js: "EdgeResponseStatus", typ: 0 },
        { json: "EdgeStartTimestamp", js: "EdgeStartTimestamp", typ: Date },
        { json: "RayID", js: "RayID", typ: "" },
        { json: "CacheCacheStatus", js: "CacheCacheStatus", typ: "" },
        { json: "CacheResponseBytes", js: "CacheResponseBytes", typ: 0 },
        { json: "CacheResponseStatus", js: "CacheResponseStatus", typ: 0 },
        { json: "CacheTieredFill", js: "CacheTieredFill", typ: true },
        { json: "ClientASN", js: "ClientASN", typ: 0 },
        { json: "ClientCountry", js: "ClientCountry", typ: "" },
        { json: "ClientDeviceType", js: "ClientDeviceType", typ: "" },
        { json: "ClientIPClass", js: "ClientIPClass", typ: "" },
        { json: "ClientMTLSAuthCertFingerprint", js: "ClientMTLSAuthCertFingerprint", typ: "" },
        { json: "ClientMTLSAuthStatus", js: "ClientMTLSAuthStatus", typ: "" },
        { json: "ClientRegionCode", js: "ClientRegionCode", typ: u(undefined, "") },
        { json: "ClientRequestBytes", js: "ClientRequestBytes", typ: 0 },
        { json: "ClientRequestPath", js: "ClientRequestPath", typ: "" },
        { json: "ClientRequestProtocol", js: "ClientRequestProtocol", typ: "" },
        { json: "ClientRequestReferer", js: "ClientRequestReferer", typ: "" },
        { json: "ClientRequestScheme", js: "ClientRequestScheme", typ: "" },
        { json: "ClientRequestSource", js: "ClientRequestSource", typ: "" },
        { json: "ClientRequestUserAgent", js: "ClientRequestUserAgent", typ: "" },
        { json: "ClientSSLCipher", js: "ClientSSLCipher", typ: "" },
        { json: "ClientSSLProtocol", js: "ClientSSLProtocol", typ: "" },
        { json: "ClientSrcPort", js: "ClientSrcPort", typ: 0 },
        { json: "ClientTCPRTTMs", js: "ClientTCPRTTMs", typ: 0 },
        { json: "ClientXRequestedWith", js: "ClientXRequestedWith", typ: "" },
        { json: "Cookies", js: "Cookies", typ: r("Cookies") },
        { json: "ContentScanObjResults", js: "ContentScanObjResults", typ: u(undefined, a("")) },
        { json: "ContentScanObjTypes", js: "ContentScanObjTypes", typ: u(undefined, a("")) },
        { json: "EdgeCFConnectingO2O", js: "EdgeCFConnectingO2O", typ: true },
        { json: "EdgeColoCode", js: "EdgeColoCode", typ: "" },
        { json: "EdgeColoID", js: "EdgeColoID", typ: 0 },
        { json: "EdgePathingOp", js: "EdgePathingOp", typ: "" },
        { json: "EdgePathingSrc", js: "EdgePathingSrc", typ: "" },
        { json: "EdgePathingStatus", js: "EdgePathingStatus", typ: "" },
        { json: "EdgeRateLimitAction", js: "EdgeRateLimitAction", typ: "" },
        { json: "EdgeRateLimitID", js: "EdgeRateLimitID", typ: 0 },
        { json: "EdgeRequestHost", js: "EdgeRequestHost", typ: "" },
        { json: "EdgeResponseBodyBytes", js: "EdgeResponseBodyBytes", typ: 0 },
        { json: "EdgeResponseCompressionRatio", js: "EdgeResponseCompressionRatio", typ: 0 },
        { json: "EdgeResponseContentType", js: "EdgeResponseContentType", typ: "" },
        { json: "EdgeServerIP", js: "EdgeServerIP", typ: "" },
        { json: "EdgeTimeToFirstByteMs", js: "EdgeTimeToFirstByteMs", typ: 0 },
        { json: "FirewallMatchesActions", js: "FirewallMatchesActions", typ: a("any") },
        { json: "FirewallMatchesRuleIDs", js: "FirewallMatchesRuleIDs", typ: a("any") },
        { json: "FirewallMatchesSources", js: "FirewallMatchesSources", typ: a("any") },
        { json: "OriginDNSResponseTimeMs", js: "OriginDNSResponseTimeMs", typ: 0 },
        { json: "OriginIP", js: "OriginIP", typ: "" },
        { json: "OriginRequestHeaderSendDurationMs", js: "OriginRequestHeaderSendDurationMs", typ: 0 },
        { json: "OriginResponseBytes", js: "OriginResponseBytes", typ: 0 },
        { json: "OriginResponseDurationMs", js: "OriginResponseDurationMs", typ: 0 },
        { json: "OriginResponseHTTPExpires", js: "OriginResponseHTTPExpires", typ: "" },
        { json: "OriginResponseHTTPLastModified", js: "OriginResponseHTTPLastModified", typ: "" },
        { json: "OriginResponseHeaderReceiveDurationMs", js: "OriginResponseHeaderReceiveDurationMs", typ: 0 },
        { json: "OriginResponseStatus", js: "OriginResponseStatus", typ: 0 },
        { json: "OriginResponseTime", js: "OriginResponseTime", typ: 0 },
        { json: "OriginSSLProtocol", js: "OriginSSLProtocol", typ: "" },
        { json: "OriginTCPHandshakeDurationMs", js: "OriginTCPHandshakeDurationMs", typ: 0 },
        { json: "OriginTLSHandshakeDurationMs", js: "OriginTLSHandshakeDurationMs", typ: 0 },
        { json: "ParentRayID", js: "ParentRayID", typ: "" },
        { json: "RequestHeaders", js: "RequestHeaders", typ: r("RequestHeaders") },
        { json: "ResponseHeaders", js: "ResponseHeaders", typ: r("ResponseHeaders") },
        { json: "SecurityAction", js: "SecurityAction", typ: u(undefined, "") },
        { json: "SecurityActions", js: "SecurityActions", typ: u(undefined, a("")) },
        { json: "SecurityLevel", js: "SecurityLevel", typ: "" },
        { json: "SecurityRuleDescription", js: "SecurityRuleDescription", typ: u(undefined, "") },
        { json: "SecurityRuleID", js: "SecurityRuleID", typ: u(undefined, "") },
        { json: "SecurityRuleIDs", js: "SecurityRuleIDs", typ: u(undefined, a("")) },
        { json: "SecuritySources", js: "SecuritySources", typ: u(undefined, a("")) },
        { json: "SmartRouteColoID", js: "SmartRouteColoID", typ: 0 },
        { json: "UpperTierColoID", js: "UpperTierColoID", typ: 0 },
        { json: "WAFAction", js: "WAFAction", typ: "" },
        { json: "WAFAttackScore", js: "WAFAttackScore", typ: u(undefined, 0) },
        { json: "WAFFlags", js: "WAFFlags", typ: "" },
        { json: "WAFMatchedVar", js: "WAFMatchedVar", typ: "" },
        { json: "WAFProfile", js: "WAFProfile", typ: "" },
        { json: "WAFRCEAttackScore", js: "WAFRCEAttackScore", typ: u(undefined, 0) },
        { json: "WAFRuleID", js: "WAFRuleID", typ: "" },
        { json: "WAFRuleMessage", js: "WAFRuleMessage", typ: "" },
        { json: "WAFSQLiAttackScore", js: "WAFSQLiAttackScore", typ: u(undefined, 0) },
        { json: "WAFXSSAttackScore", js: "WAFXSSAttackScore", typ: u(undefined, 0) },
        { json: "WorkerCPUTime", js: "WorkerCPUTime", typ: 0 },
        { json: "WorkerStatus", js: "WorkerStatus", typ: "" },
        { json: "WorkerSubrequest", js: "WorkerSubrequest", typ: true },
        { json: "WorkerSubrequestCount", js: "WorkerSubrequestCount", typ: 0 },
        { json: "ZoneID", js: "ZoneID", typ: u(undefined, 0) },
        { json: "ZoneName", js: "ZoneName", typ: "" },
        { json: "CacheReserveUsed", js: "CacheReserveUsed", typ: true },
        { json: "WorkerWallTimeUs", js: "WorkerWallTimeUs", typ: 0 },
    ], false),
    "Cookies": o([
    ], false),
    "RequestHeaders": o([
        { json: "cf-access-user", js: "cf-access-user", typ: u(undefined, "") },
        { json: "x-api-key", js: "x-api-key", typ: u(undefined, "") },
    ], false),
    "ResponseHeaders": o([
        { json: "x-meteored-node", js: "x-meteored-node", typ: u(undefined, "") },
        { json: "x-meteored-version", js: "x-meteored-version", typ: u(undefined, "") },
        { json: "x-meteored-zone", js: "x-meteored-zone", typ: u(undefined, "") },
        { json: "expires", js: "expires", typ: u(undefined, "") },
        { json: "etag", js: "etag", typ: u(undefined, "") },
        { json: "last-modified", js: "last-modified", typ: u(undefined, "") },
    ], false),
};
