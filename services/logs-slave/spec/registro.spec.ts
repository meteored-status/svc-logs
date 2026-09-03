import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {type IRAWData, Registro} from "../modules/data/registro";
import {RegistroPeticion} from "../modules/data/registro/peticion";
import {RegistroOrigen} from "../modules/data/registro/origen";
import {cliente} from "./cliente";

const raw = (extra: Partial<IRAWData> = {}): IRAWData => ({
    client: {
        bot: false,
        country: "es",
        device: {type: "desktop"},
        ip: {value: "8.8.8.8", class: "noRecord"},
        request: {
            host: "www.tiempo.es",
            method: "GET",
            path: "/madrid.html",
            protocol: "HTTP/2",
            scheme: "https",
            source: "edgeWorkerFetch",
            ua: "Mozilla/5.0",
            uri: "/madrid.html?x=1",
        },
    },
    edge: {
        request: {host: "www.tiempo.es"},
        response: {contentType: "text/html", status: 200},
        timestamp: {start: new Date("2026-01-01T10:00:00Z")},
    },
    cache: {reserve: {used: false}, status: "hit", tiered: {fill: false}},
    cookies: {},
    request: {headers: {}},
    response: {headers: {}},
    zone: {name: "tiempo.es"},
    ...extra,
});

describe("RegistroPeticion", () => {

    it("recorta la zona del final del host para obtener el subdominio", () => {
        const peticion = RegistroPeticion.build(raw().client, {headers: {}}, "tiempo.es");

        assert.equal(peticion.dominio, "www.tiempo.es");
        assert.equal(peticion.subdominio, "www");
    });

    it("deja el subdominio vacío en el dominio apex", () => {
        const data = raw();
        data.client.request.host = "tiempo.es";

        assert.equal(RegistroPeticion.build(data.client, {headers: {}}, "tiempo.es").subdominio, "");
    });

    it("solo incluye headers cuando hay api key", () => {
        assert.equal(RegistroPeticion.build(raw().client, {headers: {}}, "tiempo.es").headers, undefined);
        assert.deepEqual(RegistroPeticion.build(raw().client, {headers: {apiKey: "k1"}}, "tiempo.es").headers, {apiKey: "k1"});
    });
});

describe("RegistroOrigen", () => {

    it("resuelve el nombre del backend contra el catálogo del cliente", () => {
        const origen = RegistroOrigen.build({ip: "34.38.93.178", response: {duration: 12}}, {"34.38.93.178": "GKE Bélgica"});

        assert.equal(origen?.nombre, "GKE Bélgica");
    });

    it("deja el nombre sin resolver si la ip no está en el catálogo", () => {
        const origen = RegistroOrigen.build({ip: "1.2.3.4", response: {duration: 12}}, {});

        assert.equal(origen?.ip, "1.2.3.4");
        assert.equal(origen?.nombre, undefined);
    });

    it("no genera origen si Cloudflare no lo reportó", () => {
        assert.equal(RegistroOrigen.build(undefined, {}), undefined);
    });
});

describe("Registro", () => {

    it("compone la url a partir de esquema, host y uri", () => {
        const registro = Registro.build(raw(), cliente("tiempo"));

        assert.equal(registro.url.toString(), "https://www.tiempo.es/madrid.html?x=1");
        assert.equal(registro.toJSON().timestamp, "2026-01-01T10:00:00.000Z");
    });

    it("usa el header x-meteored-service como subproyecto si el cliente no tiene grupo", () => {
        const data = raw();
        data.response.headers.service = "frontend";

        const registro = Registro.build(data, cliente("tiempo"));

        assert.equal(registro.proyecto, "tiempo");
        assert.equal(registro.subproyecto, "frontend");
    });

    it("el grupo del cliente tiene prioridad sobre el header de servicio", () => {
        const data = raw();
        data.response.headers.service = "frontend";

        const registro = Registro.build(data, cliente("tiempo", "es"));

        assert.equal(registro.proyecto, "tiempo");
        assert.equal(registro.subproyecto, "es");
    });

    it("toCrawler rellena crawler y agent aunque no se hayan detectado", () => {
        const registro = Registro.build(raw(), cliente("tiempo"));
        const crawler = registro.toCrawler();

        assert.equal(crawler.cliente.crawler, "Unknown");
        assert.equal(crawler.cliente.agent, "Mozilla/5.0");
    });
});

describe("Registro.toApp", () => {

    const construir = (path: string = "/app/datos"): Registro => {
        const data = raw();
        data.client.request.path = path;

        return Registro.build(data, cliente("mr"));
    };

    it("parsea el header meteored completo", () => {
        const registro = construir();
        const app = registro.toApp("android 15.1; 3.2.1/com.meteored.app(pro);bg");

        assert.equal(app.sistema, "android");
        assert.deepEqual(app.os, {nombre: "android", version: "15.1"});
        assert.deepEqual(app.app, {package: "com.meteored.app", version: "3.2.1", sufijo: "pro", ambient: "bg"});
    });

    it("deja sufijo y ambient sin rellenar cuando no vienen", () => {
        const app = (construir()).toApp("ios 18; 1.0/com.meteored.app");

        assert.equal(app.app.sufijo, undefined);
        assert.equal(app.app.ambient, undefined);
    });

    it("marca todo como unknown cuando no hay header", () => {
        const app = (construir()).toApp();

        assert.equal(app.sistema, "unknown");
        assert.equal(app.app.package, "unknown");
        assert.equal(app.app.version, "unknown");
    });

    it("marca el servicio como legacy en las peticiones móviles sin header", () => {
        const registro = construir("/peticionMovil.php");

        assert.equal(registro.toApp().servicio, "legacy");
    });

    it("lanza si el header no casa con el formato esperado", () => {
        const registro = construir();

        assert.throws(() => registro.toApp("esto no es un header"), /Header de App inválido/);
    });
});
