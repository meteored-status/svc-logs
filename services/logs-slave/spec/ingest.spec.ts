import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {esApp, nuevaSalida, procesarLinea} from "../modules/data/source/parser";
import {cliente} from "./cliente";

import type {IRAWData} from "../modules/data/registro";

const LINEA: Record<string, unknown> = {
    CacheCacheStatus: "hit",
    CacheReserveUsed: false,
    CacheTieredFill: false,
    ClientCountry: "es",
    ClientDeviceType: "desktop",
    ClientIP: "8.8.8.8",
    ClientIPClass: "noRecord",
    ClientRequestHost: "www.tiempo.es",
    ClientRequestMethod: "GET",
    ClientRequestPath: "/madrid.html",
    ClientRequestProtocol: "HTTP/2",
    ClientRequestReferer: "",
    ClientRequestScheme: "https",
    ClientRequestSource: "edgeWorkerFetch",
    ClientRequestURI: "/madrid.html",
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

const linea = (extra: Record<string, unknown> = {}): string => JSON.stringify({...LINEA, ...extra});

const rawApp = (id: string, path: string, app?: string): IRAWData => ({
    client: {
        bot: false,
        country: "es",
        device: {type: "mobile"},
        ip: {value: "8.8.8.8", class: "noRecord"},
        request: {
            host: `www.${id}.es`, method: "GET", path, protocol: "HTTP/2",
            scheme: "https", source: "edgeWorkerFetch", uri: path,
        },
    },
    edge: {
        request: {host: `www.${id}.es`},
        response: {contentType: "text/html", status: 200},
        timestamp: {start: new Date()},
    },
    cache: {reserve: {used: false}, status: "hit", tiered: {fill: false}},
    cookies: {},
    request: {headers: {app}},
    response: {headers: {}},
    zone: {name: `${id}.es`},
});

describe("esApp", () => {

    it("reconoce la app por el header meteored en cualquier cliente", () => {
        const ed = cliente("ed");

        assert.equal(esApp(ed, rawApp("ed", "/lo-que-sea", "android 15; 1.0/com.meteored.app")), true);
        assert.equal(esApp(ed, rawApp("ed", "/lo-que-sea")), false);
    });

    it("aplica la heurística legacy /app/ solo al cliente mr", () => {
        assert.equal(esApp(cliente("mr"), rawApp("mr", "/app/datos")), true);
        assert.equal(esApp(cliente("tiempo"), rawApp("tiempo", "/app/datos")), false);
    });

    it("aplica la heurística legacy peticionMovil.php solo al cliente tiempo", () => {
        assert.equal(esApp(cliente("tiempo"), rawApp("tiempo", "/api/peticionMovil.php?x=1")), true);
        assert.equal(esApp(cliente("mr"), rawApp("mr", "/api/peticionMovil.php?x=1")), false);
    });
});

describe("procesarLinea", () => {

    it("acumula la fila de accesos", () => {
        const salida = nuevaSalida();
        procesarLinea(cliente("tiempo"), linea(), salida);

        assert.equal(salida.accesos.length, 1);
        assert.equal(salida.crawler.length, 0);
        assert.equal(salida.app.length, 0);
        assert.equal(salida.accesos[0].proyecto, "tiempo");
    });

    it("descarta el tráfico interno de Cloudflare", () => {
        const salida = nuevaSalida();
        procesarLinea(cliente("tiempo"), linea({ClientRequestPath: "/cdn-cgi/trace"}), salida);

        assert.deepEqual(salida, nuevaSalida());
    });

    it("duplica la fila en crawler cuando Cloudflare marcó bot verificado", () => {
        const salida = nuevaSalida();
        procesarLinea(cliente("tiempo"), linea({VerifiedBotCategory: "Search Engine Crawler"}), salida);

        assert.equal(salida.accesos.length, 1);
        assert.equal(salida.crawler.length, 1);
    });

    it("añade la fila de app cuando viene el header meteored", () => {
        const salida = nuevaSalida();
        procesarLinea(cliente("tiempo"), linea({
            RequestHeaders: {"meteored": "android 15; 3.2.1/com.meteored.app"},
        }), salida);

        assert.equal(salida.accesos.length, 1);
        assert.equal(salida.app.length, 1);
        assert.equal(salida.app[0].app.package, "com.meteored.app");
    });

    it("conserva la fila de accesos aunque el header de app sea inválido", () => {
        const salida = nuevaSalida();
        procesarLinea(cliente("tiempo"), linea({
            RequestHeaders: {"meteored": "basura"},
        }), salida);

        assert.equal(salida.accesos.length, 1, "el acceso no puede perderse por un header de app roto");
        assert.equal(salida.app.length, 0);
    });

    it("lanza con una línea corrupta, para que el bucle pueda descartarla y seguir", () => {
        const tiempo = cliente("tiempo");

        assert.throws(() => procesarLinea(tiempo, "{esto no es json", nuevaSalida()));
        assert.throws(() => procesarLinea(tiempo, JSON.stringify({ClientIP: "8.8.8.8"}), nuevaSalida()));
    });
});
