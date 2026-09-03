import {describe, it} from "node:test";
import assert from "node:assert/strict";

import SCHEMA from "../modules/data/source/cloudflare";

const LINEA: Record<string, unknown> = {
    CacheCacheStatus: "hit",
    CacheReserveUsed: false,
    CacheTieredFill: true,
    ClientCountry: "es",
    ClientDeviceType: "desktop",
    ClientIP: "8.8.8.8",
    ClientIPClass: "noRecord",
    ClientRegionCode: "MC",
    ClientRequestHost: "www.tiempo.es",
    ClientRequestMethod: "GET",
    ClientRequestPath: "/madrid.html",
    ClientRequestProtocol: "HTTP/2",
    ClientRequestReferer: "",
    ClientRequestScheme: "https",
    ClientRequestSource: "edgeWorkerFetch",
    ClientRequestURI: "/madrid.html?x=1",
    ClientRequestUserAgent: "Mozilla/5.0",
    Cookies: {},
    EdgeRequestHost: "www.tiempo.es",
    EdgeResponseContentType: "text/html",
    EdgeResponseStatus: 200,
    EdgeStartTimestamp: "2026-01-01T10:00:00Z",
    OriginIP: "",
    OriginResponseDurationMs: 0,
    RequestHeaders: {},
    ResponseHeaders: {},
    VerifiedBotCategory: "",
    WorkerSubrequest: false,
    ZoneName: "tiempo.es",
};

const parse = (extra: Record<string, unknown> = {}) => SCHEMA.parse({...LINEA, ...extra});

describe("esquema de Cloudflare", () => {

    it("reestructura la línea plana en la forma anidada que consume Registro", () => {
        const data = parse();

        assert.equal(data.client.ip.value, "8.8.8.8");
        assert.equal(data.client.request.host, "www.tiempo.es");
        assert.equal(data.edge.response.status, 200);
        assert.equal(data.cache.status, "hit");
        assert.equal(data.cache.tiered.fill, true);
        assert.equal(data.zone.name, "tiempo.es");
    });

    it("acepta el timestamp como cadena ISO", () => {
        const data = parse({EdgeStartTimestamp: "2026-01-01T10:00:00Z"});

        assert.equal(data.edge.timestamp.start.toISOString(), "2026-01-01T10:00:00.000Z");
    });

    it("interpreta el timestamp numérico como nanosegundos Unix", () => {
        const data = parse({EdgeStartTimestamp: 1767261600000000000});

        assert.equal(data.edge.timestamp.start.toISOString(), "2026-01-01T10:00:00.000Z");
    });

    it("normaliza el referer vacío a undefined", () => {
        assert.equal(parse().client.request.referer, undefined);
        assert.equal(parse({ClientRequestReferer: "https://www.google.com/"}).client.request.referer, "https://www.google.com/");
    });

    it("omite el origen cuando Cloudflare no reporta OriginIP", () => {
        assert.equal(parse().origin, undefined);

        const conOrigen = parse({OriginIP: "34.38.93.178", OriginResponseDurationMs: 120});
        assert.equal(conOrigen.origin?.ip, "34.38.93.178");
        assert.equal(conOrigen.origin?.response.duration, 120);
    });

    it("marca bot cuando VerifiedBotCategory no viene vacío", () => {
        assert.equal(parse().client.bot, false);
        assert.equal(parse({VerifiedBotCategory: "Search Engine Crawler"}).client.bot, true);
    });

    it("renombra las cabeceras de meteored", () => {
        const data = parse({
            Cookies: {"cf-access-user": "u1", "meteored": "m1"},
            RequestHeaders: {"x-api-key": "k1", "meteored": "android 15; 1.0/com.meteored.app"},
            ResponseHeaders: {"x-meteored-node": "n1", "x-meteored-service": "es", "x-meteored-version": "v1"},
        });

        assert.equal(data.cookies.user, "u1");
        assert.equal(data.cookies.mrid, "m1");
        assert.equal(data.request.headers.apiKey, "k1");
        assert.equal(data.request.headers.app, "android 15; 1.0/com.meteored.app");
        assert.deepEqual(data.response.headers, {node: "n1", service: "es", version: "v1"});
    });

    it("rechaza una línea a la que le falta un campo obligatorio", () => {
        const {ZoneName, ...incompleta} = LINEA;
        void ZoneName;

        assert.throws(() => SCHEMA.parse(incompleta));
    });
});
