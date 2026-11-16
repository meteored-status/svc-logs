/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 0a2874bfc59b92bfa8697438566bdc42
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {EEntorno} from "@mr/core-log/interface";

import {construirContexto, construirHeartbeat, revisionDePod} from "../heartbeat/payload";
import type {IMetadatosPod} from "../heartbeat/metadatos";

/**
 * Lo que sale en el mensaje: qué es el `pod` en cada entorno, de dónde sale cada campo, y que `procesos`
 * solo aparece en cluster.
 */

const metadatos: IMetadatosPod = {
    cluster: {valor: "status-madrid-2", origen: "metadata"},
    proyecto: {valor: "meteored-status", origen: "metadata"},
    ubicacion: {valor: "europe-southwest1", origen: "metadata"},
};
const pod = {servicio: "status-backend", zona: "madrid", version: "2026.11.12-001"};
const env = {K8S_NAMESPACE: "meteored-status", POD_DPTO: "sistemas", POD_PRODUCTO: "status"};
const metricas = {rss: 1, loopP99: 2, loopMax: 3, uptime: 4};
const foto = {seq: 7, ts: 1000, estado: "listo" as const, anterior: "arrancando" as const, desde: 900, tseq: 2, causaDrenado: null, metricas};

const contexto = (entorno: EEntorno, produccion: boolean) => construirContexto({pod, entorno, env, servicio: "mr-status/status-backend", hostname: "status-backend-abc-xyz", metadatos, inicio: 500, produccion});

describe("construirContexto", () => {
    it("en producción el pod es el hostname", () => {
        const c = contexto(EEntorno.PRODUCCION, true);
        assert.equal(c.pod, "status-backend-abc-xyz");
        assert.equal(c.entorno, EEntorno.PRODUCCION);
        assert.equal(c.cluster, "status-madrid-2");
        assert.equal(c.proyectoGcp, "meteored-status");
        assert.equal(c.ubicacion, "europe-southwest1");
        assert.equal(c.namespace, "meteored-status");
        assert.equal(c.departamento, "sistemas");
        assert.equal(c.producto, "status");
        assert.equal(c.version, "2026.11.12-001");
        assert.equal(c.inicio, 500);
    });

    it("en test es producción a efectos del nombre del pod, pero el entorno es TEST", () => {
        const c = contexto(EEntorno.TEST, true);
        assert.equal(c.pod, "status-backend-abc-xyz");
        assert.equal(c.entorno, EEntorno.TEST);
    });

    it("en desarrollo el pod lleva el servicio detrás del hostname", () => {
        assert.equal(contexto(EEntorno.DESARROLLO, false).pod, "status-backend-abc-xyz/status-backend");
    });

    it("sin variables ni metadatos los campos quedan vacíos, no undefined", () => {
        const vacio: IMetadatosPod = {cluster: {valor: "", origen: "vacío"}, proyecto: {valor: "", origen: "vacío"}, ubicacion: {valor: "", origen: "vacío"}};
        const c = construirContexto({pod, entorno: EEntorno.DESARROLLO, env: {}, servicio: "x", hostname: "h", metadatos: vacio, inicio: 1, produccion: false});
        assert.deepEqual([c.cluster, c.proyectoGcp, c.ubicacion, c.namespace, c.producto, c.departamento], ["", "", "", "", "", ""]);
    });
});

describe("revisión del despliegue (revision)", () => {
    const real = "status-backend-5d8c7b9f6b-x7k2p";

    it("POD_REVISION manda, también sobre el hostname", () => {
        assert.equal(revisionDePod({env: {POD_REVISION: "7c9d5f8b4"}, hostname: real, produccion: true}), "7c9d5f8b4");
        assert.equal(revisionDePod({env: {POD_REVISION: " 7c9d5f8b4\n"}, hostname: "x", produccion: true}), "7c9d5f8b4");
    });

    it("sin la variable, en producción sale del penúltimo trozo del hostname <deployment>-<hash>-<sufijo>", () => {
        assert.equal(revisionDePod({env: {}, hostname: real, produccion: true}), "5d8c7b9f6b");
        assert.equal(revisionDePod({env: {POD_REVISION: ""}, hostname: "a-b-c-5d8c7b9f6b-x7k2p", produccion: true}), "5d8c7b9f6b");
    });

    it("un hostname que no tiene esa forma da vacío, sin inventar un trozo", () => {
        for (const hostname of ["status-backend", "localhost", "status-backend-abc-xyz", "status-backend-5d8c7b9f6b-sufijolargo", "status-backend-5D8C7B9F6B-x7k2p", ""]) {
            assert.equal(revisionDePod({env: {}, hostname, produccion: true}), "", hostname);
        }
    });

    it("fuera del clúster va vacía, aunque el hostname parezca un pod", () => {
        assert.equal(revisionDePod({env: {}, hostname: real, produccion: false}), "");
    });

    it("un POD_REVISION que el receptor descartaría (más de 16 o fuera de a-z0-9) se manda vacío y se avisa", () => {
        for (const declarada of ["a".repeat(17), "7C9D5F8B4", "7c9d-5f8b4", "7c9d5f8b4/x"]) {
            const avisos: string[] = [];
            assert.equal(revisionDePod({env: {POD_REVISION: declarada}, hostname: real, produccion: true, avisar: (m) => { avisos.push(m); }}), "", declarada);
            assert.equal(avisos.length, 1, declarada);
            assert.equal(avisos[0]?.includes(declarada), false, "no debe llevar el valor");
        }
        assert.equal(revisionDePod({env: {POD_REVISION: "a".repeat(16)}, hostname: real, produccion: true}), "a".repeat(16));
        assert.equal(revisionDePod({env: {POD_REVISION: "a".repeat(17)}, hostname: real, produccion: true}), "");
    });

    it("el aviso llega desde construirContexto, una vez", () => {
        const avisos: string[] = [];
        const c = construirContexto({pod, entorno: EEntorno.PRODUCCION, env: {POD_REVISION: "a".repeat(40)}, servicio: "x", hostname: real, metadatos, inicio: 1, produccion: true, avisar: (m) => { avisos.push(m); }});
        assert.equal(c.revision, "");
        assert.equal(avisos.length, 1);
    });

    it("llega al mensaje, en el contexto y en cada heartbeat", () => {
        const c = construirContexto({pod, entorno: EEntorno.PRODUCCION, env: {POD_REVISION: "7c9d5f8b4"}, servicio: "x", hostname: real, metadatos, inicio: 1, produccion: true});
        assert.equal(c.revision, "7c9d5f8b4");
        assert.equal(construirHeartbeat(c, foto).revision, "7c9d5f8b4");
        assert.equal(contexto(EEntorno.DESARROLLO, false).revision, "");
    });
});

describe("construirHeartbeat", () => {
    it("junta contexto y foto, con v=1", () => {
        const h = construirHeartbeat(contexto(EEntorno.PRODUCCION, true), foto);
        assert.equal(h.v, 1);
        assert.equal(h.seq, 7);
        assert.equal(h.estado, "listo");
        assert.equal(h.anterior, "arrancando");
        assert.equal(h.tseq, 2);
        assert.equal(h.pod, "status-backend-abc-xyz");
        assert.deepEqual(h.metricas, metricas);
        assert.equal("procesos" in h, false);
    });

    it("procesos solo aparece si lo hay", () => {
        const h = construirHeartbeat(contexto(EEntorno.PRODUCCION, true), {...foto, procesos: {total: 4, listos: 3}});
        assert.deepEqual(h.procesos, {total: 4, listos: 3});
    });

    it("sobrevive a un JSON de ida y vuelta sin perder campos", () => {
        const h = construirHeartbeat(contexto(EEntorno.TEST, true), {...foto, causaDrenado: "prestop", estado: "drenando"});
        assert.deepEqual(JSON.parse(JSON.stringify(h)), h);
    });
});
