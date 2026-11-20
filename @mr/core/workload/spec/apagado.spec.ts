/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: 994584e3cdeb9c61856d9d96cc2e5350
 * Versión: 2026.11.20+1-bixus
 * Anterior: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {avisos, infos, limpiarAvisos} from "./stubs/log";
import {type IConfigSenal, type IEngineApagable, atenderSenal, instalarApagado} from "../engine/apagado";

/**
 * Cierre por señal de un proceso que no es el primario de un cluster: señal repetida, servidor HTTP que ya la
 * atiende, cronjob con `ejecutar()` en marcha, y proceso sin HTTP de larga vida (con y sin heartbeat).
 */

const montar = (orden: string[], {apagadoPorServidor = false, tarda = 0}: {apagadoPorServidor?: boolean; tarda?: number} = {}): IEngineApagable => ({
    apagadoPorServidor,
    solicitarApagado: async (motivo) => {
        orden.push(`apagado:${motivo}`);
        if (tarda === Infinity) {
            await new Promise<void>(() => undefined);
        }
        await new Promise<void>(resolve => setTimeout(resolve, tarda));
        orden.push("apagado:fin");
    },
});

const base = (orden: string[], engine: IEngineApagable|null, resto: Partial<IConfigSenal> = {}): IConfigSenal => ({
    senal: "SIGTERM",
    repetida: false,
    engine,
    ejecucionPendiente: false,
    emisor: null,
    esperaMs: 1000,
    produccion: true,
    salir: (codigo) => { orden.push(`salir:${codigo}`); },
    ...resto,
});

describe("atenderSenal", () => {
    it("una señal repetida sale ya con 128 + n: 143 con SIGTERM y 130 con SIGINT, sin tocar el engine", async () => {
        const orden: string[] = [];
        await atenderSenal(base(orden, montar(orden), {repetida: true}));
        await atenderSenal(base(orden, montar(orden), {repetida: true, senal: "SIGINT"}));
        assert.deepEqual(orden, ["salir:143", "salir:130"]);
    });

    it("sin engine todavía sale con 128 + n", async () => {
        const orden: string[] = [];
        await atenderSenal(base(orden, null));
        assert.deepEqual(orden, ["salir:143"]);
    });

    it("si el servidor HTTP atiende la señal no hace nada ni la escribe en el log (ya lo hace el servidor)", async () => {
        limpiarAvisos();
        const orden: string[] = [];
        await atenderSenal(base(orden, montar(orden, {apagadoPorServidor: true})));
        assert.deepEqual(orden, []);
        assert.deepEqual(infos, []);
    });

    it("si el servidor la atiende pero la señal es repetida, sale ya con 128 + n", async () => {
        const orden: string[] = [];
        await atenderSenal(base(orden, montar(orden, {apagadoPorServidor: true}), {repetida: true}));
        assert.deepEqual(orden, ["salir:143"]);
    });

    it("en producción, con la ejecución de un cronjob en marcha pide el apagado pero no sale", async () => {
        const orden: string[] = [];
        await atenderSenal(base(orden, montar(orden), {ejecucionPendiente: true}));
        assert.deepEqual(orden, ["apagado:Recibida señal SIGTERM", "apagado:fin"]);
    });

    it("en producción, la señal con la ejecución de un cronjob en marcha marca el cierre en el heartbeat (drenando/senal) antes de pedir el apagado, sin despedirse ni salir", async () => {
        const orden: string[] = [];
        const emisor = {alIniciarCierre: () => { orden.push("drenando"); }, despedir: async () => { orden.push("despedir"); }};
        await atenderSenal(base(orden, montar(orden), {ejecucionPendiente: true, emisor}));
        assert.deepEqual(orden, ["drenando", "apagado:Recibida señal SIGTERM", "apagado:fin"]);
    });

    it("si alIniciarCierre falla, el apagado del cronjob sigue adelante", async () => {
        limpiarAvisos();
        const orden: string[] = [];
        const emisor = {alIniciarCierre: () => { throw new Error("boom"); }, despedir: async () => { orden.push("despedir"); }};
        await atenderSenal(base(orden, montar(orden), {ejecucionPendiente: true, emisor}));
        assert.deepEqual(orden, ["apagado:Recibida señal SIGTERM", "apagado:fin"]);
        assert.equal(avisos.length, 1);
    });

    it("en desarrollo, un cronjob en marcha pide el apagado y sale con 128 + n (node --watch no espera a que acabe)", async () => {
        const orden: string[] = [];
        await atenderSenal(base(orden, montar(orden), {ejecucionPendiente: true, produccion: false}));
        assert.deepEqual(orden, ["apagado:Recibida señal SIGTERM", "apagado:fin", "salir:143"]);
    });

    it("en desarrollo, un cronjob cuyo shutdown no termina sale igualmente a esperaMs", async () => {
        limpiarAvisos();
        const orden: string[] = [];
        const t0 = Date.now();
        await atenderSenal(base(orden, montar(orden, {tarda: Infinity}), {ejecucionPendiente: true, produccion: false, esperaMs: 80, senal: "SIGINT"}));
        const espera = Date.now() - t0;
        assert.deepEqual(orden, ["apagado:Recibida señal SIGINT", "salir:130"]);
        assert.ok(espera >= 70 && espera < 600, `esperó ${espera} ms`);
        assert.equal(avisos.length, 1);
    });

    it("un proceso sin HTTP pide el apagado, avisa al heartbeat, se despide y sale con 0", async () => {
        const orden: string[] = [];
        const emisor = {alIniciarCierre: () => { orden.push("drenando"); }, despedir: async () => { orden.push("despedir"); }};
        await atenderSenal(base(orden, montar(orden, {tarda: 20}), {emisor}));
        assert.deepEqual(orden, ["drenando", "apagado:Recibida señal SIGTERM", "apagado:fin", "despedir", "salir:0"]);
    });

    it("sin heartbeat: apagado y salida", async () => {
        const orden: string[] = [];
        await atenderSenal(base(orden, montar(orden)));
        assert.deepEqual(orden, ["apagado:Recibida señal SIGTERM", "apagado:fin", "salir:0"]);
    });

    it("un shutdown que no termina se corta a esperaMs con un aviso y se sale con 0", async () => {
        limpiarAvisos();
        const orden: string[] = [];
        const t0 = Date.now();
        await atenderSenal(base(orden, montar(orden, {tarda: Infinity}), {esperaMs: 80}));
        const espera = Date.now() - t0;
        assert.deepEqual(orden, ["apagado:Recibida señal SIGTERM", "salir:0"]);
        assert.ok(espera >= 70 && espera < 600, `esperó ${espera} ms`);
        assert.equal(avisos.length, 1);
    });
});

describe("instalarApagado", () => {
    it("la primera señal se atiende y una segunda, de cualquiera de las dos, sale ya con 128 + n", async () => {
        const orden: string[] = [];
        const quitar = instalarApagado({
            estado: () => ({engine: montar(orden), ejecucionPendiente: true, emisor: null}),
            salir: (codigo) => { orden.push(`salir:${codigo}`); },
            produccion: true,
        });
        try {
            process.emit("SIGTERM", "SIGTERM");
            await new Promise<void>(resolve => setTimeout(resolve, 20));
            assert.deepEqual(orden, ["apagado:Recibida señal SIGTERM", "apagado:fin"]);
            process.emit("SIGINT", "SIGINT");
            await new Promise<void>(resolve => setTimeout(resolve, 20));
            assert.deepEqual(orden.slice(2), ["salir:130"]);
        } finally {
            quitar();
        }
        assert.equal(process.listenerCount("SIGTERM") + process.listenerCount("SIGINT"), 0);
    });
});
