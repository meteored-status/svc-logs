/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: 75b84aca14283d7c9dc69e8b34554873
 * Versión: 2026.11.20+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {EEntorno} from "@mr/core-log/interface";

import {Deferred} from "./stubs/promise";
import {Heartbeat, type IPoolHeartbeat} from "../heartbeat/emisor";
import type {TRespuestaPool} from "../heartbeat/despedida";
import type {IHeartbeat, IHeartbeatEjecucion} from "../heartbeat/interface";
import type {IContextoHeartbeat} from "../heartbeat/payload";
import {Sonda} from "../heartbeat/sonda";

/**
 * La despedida de una carga finita: lleva el resultado de la ejecución y, si el contexto aún no ha resuelto (ejecuciones cortas que
 * acaban antes que los metadatos de GKE), lo espera dentro de su presupuesto en vez de abandonar. Tras una señal, o en un servicio, no.
 */

const EJECUCION: IHeartbeatEjecucion = {
    job: "cronjob-x-29918140", jobUid: "uid", cronjob: "cronjob-x", programada: 1, programacion: null, zonaHoraria: null, concurrencia: null,
    plazoInicioS: null, plazoEjecucionS: null, resultado: null, error: null,
};

const CONTEXTO: IContextoHeartbeat = {
    entorno: EEntorno.PRODUCCION, proyectoGcp: "p", cluster: "c", ubicacion: "u", zona: "z", namespace: "n", pod: "cronjob-x-29918140-abcde",
    servicio: "n/cronjob-x", producto: "", departamento: "", version: "1", revision: "", inicio: 1, carga: "cronjob", ejecucion: EJECUCION,
};

const CONFIRMADO: TRespuestaPool = {ok: true, data: {v: 1, resultado: "confirmado"}};

class PoolFalso implements IPoolHeartbeat {
    public readonly enviados: IHeartbeat[] = [];
    public readonly orden: string[] = [];

    public async get<T>(_metodo: string, params?: T): Promise<TRespuestaPool> {
        this.orden.push("get");
        this.enviados.push(params as unknown as IHeartbeat);

        return CONFIRMADO;
    }

    public async head<T>(_metodo: string, params?: T): Promise<void> {
        this.orden.push("head");
        this.enviados.push(params as unknown as IHeartbeat);
    }

    public async vaciar(): Promise<void> {
        this.orden.push("vaciar");
    }

    public destroy(): void {
        this.orden.push("destroy");
    }
}

const montar = (contexto: Promise<IContextoHeartbeat>, extra: {finita?: boolean} = {}) => {
    const pool = new PoolFalso();
    const hb = new Heartbeat({
        contexto,
        pool,
        abrirNuevo: () => new PoolFalso(),
        sonda: new Sonda({finita: extra.finita ?? true}),
        finita: extra.finita ?? true,
        presupuestoDespedidaMs: 100,
        presupuestoDespedidaFinitaMs: 500,
        metricas: () => ({rss: 1, loopP99: 0, loopMax: 0, uptime: 1}),
        intervaloMs: 1_000_000,
    });

    return {pool, hb};
};

describe("Heartbeat: despedida de una carga finita", () => {
    it("el parado lleva el resultado ok y el error a null", async () => {
        const {pool, hb} = montar(Promise.resolve(CONTEXTO));
        hb.setEngine({});
        await hb.despedir({resultado: "ok", error: "ignorado"});
        const parado = pool.enviados.at(-1);
        assert.equal(parado?.estado, "parado");
        assert.equal(parado?.carga, "cronjob");
        assert.deepEqual(parado?.ejecucion, {...EJECUCION, resultado: "ok", error: null});
    });

    it("con resultado error lleva el nombre del error", async () => {
        const {pool, hb} = montar(Promise.resolve(CONTEXTO));
        await hb.despedir({resultado: "error", error: "TypeError"});
        assert.deepEqual(pool.enviados.at(-1)?.ejecucion, {...EJECUCION, resultado: "error", error: "TypeError"});
    });

    it("sin resultado (despedida por señal) la ejecución queda con resultado null", async () => {
        const {pool, hb} = montar(Promise.resolve(CONTEXTO));
        await hb.despedir();
        assert.deepEqual(pool.enviados.at(-1)?.ejecucion, EJECUCION);
    });

    it("una ejecución que recibió la señal y resolvió bien se despide sin resultado y con causa senal (el receptor la guarda como cortada)", async () => {
        const {pool, hb} = montar(Promise.resolve(CONTEXTO));
        hb.setEngine({});
        hb.alIniciarCierre();
        await hb.despedir({resultado: "ok", error: null});
        const parado = pool.enviados.at(-1);
        assert.equal(parado?.estado, "parado");
        assert.equal(parado?.causaDrenado, "senal");
        assert.deepEqual(parado?.ejecucion, {...EJECUCION, resultado: null, error: null});
    });

    it("una ejecución que falla después de recibir la señal también es cortada, sin el nombre del error", async () => {
        const {pool, hb} = montar(Promise.resolve(CONTEXTO));
        hb.setEngine({});
        hb.alIniciarCierre();
        await hb.despedir({resultado: "error", error: "AbortError"});
        const parado = pool.enviados.at(-1);
        assert.equal(parado?.causaDrenado, "senal");
        assert.deepEqual(parado?.ejecucion, {...EJECUCION, resultado: null, error: null});
    });

    it("una carga finita con señal que se despide sin resultado (desde antesDeSalir) también lleva causa senal: si no, el receptor la guarda como sin-despedida", async () => {
        const {pool, hb} = montar(Promise.resolve(CONTEXTO));
        hb.setEngine({});
        hb.alIniciarCierre();
        await hb.despedir();
        const parado = pool.enviados.at(-1);
        assert.equal(parado?.estado, "parado");
        assert.equal(parado?.causaDrenado, "senal");
        assert.deepEqual(parado?.ejecucion, EJECUCION);
    });

    it("sin señal el parado no lleva causa y conserva el resultado", async () => {
        const {pool, hb} = montar(Promise.resolve(CONTEXTO));
        hb.setEngine({});
        await hb.despedir({resultado: "ok", error: null});
        const parado = pool.enviados.at(-1);
        assert.equal(parado?.causaDrenado, null);
        assert.equal(parado?.ejecucion?.resultado, "ok");
    });

    it("el estado de la ejecución en curso es listo desde que hay engine, y el parado cierra", async () => {
        const {pool, hb} = montar(Promise.resolve(CONTEXTO));
        hb.setEngine({});
        for (let i = 0; i < 5; i++) {
            await new Promise<void>((r) => setImmediate(r));
        }
        assert.equal(pool.enviados.at(-1)?.estado, "listo");
        assert.equal(pool.enviados.at(-1)?.ejecucion?.resultado, null);
        await hb.despedir({resultado: "ok", error: null});
        assert.equal(pool.enviados.at(-1)?.estado, "parado");
    });

    it("espera al contexto que aún no ha resuelto, dentro del presupuesto, y entonces manda el parado", async () => {
        const contexto = new Deferred<IContextoHeartbeat>();
        const {pool, hb} = montar(contexto.promise);
        setTimeout(() => { contexto.resolve(CONTEXTO); }, 150);
        const t0 = Date.now();
        await hb.despedir({resultado: "ok", error: null});
        const ms = Date.now() - t0;
        assert.ok(ms >= 140, `no esperó al contexto (${ms} ms)`);
        assert.equal(pool.enviados.at(-1)?.estado, "parado");
        assert.equal(pool.enviados.at(-1)?.ejecucion?.resultado, "ok");
        assert.equal(pool.orden.at(-1), "destroy");
    });

    it("si el contexto no llega al agotar el presupuesto no manda nada, cierra el pool y no pasa del presupuesto", async () => {
        const {pool, hb} = montar(new Deferred<IContextoHeartbeat>().promise);
        const t0 = Date.now();
        await hb.despedir({resultado: "ok", error: null});
        const ms = Date.now() - t0;
        assert.equal(pool.enviados.length, 0);
        assert.deepEqual(pool.orden, ["vaciar", "destroy"]);
        assert.ok(ms >= 350 && ms < 700, `esperó ${ms} ms (presupuesto 500 menos 100 de envío)`);
    });

    it("tras una señal no espera al contexto: se despide como un servicio", async () => {
        const {pool, hb} = montar(new Deferred<IContextoHeartbeat>().promise);
        hb.alIniciarCierre();
        const t0 = Date.now();
        await hb.despedir({resultado: "error", error: "Error"});
        assert.ok(Date.now() - t0 < 250);
        assert.equal(pool.enviados.length, 0);
    });

    it("un servicio no espera al contexto aunque se despida con resultado, y su parado no lleva carga ni ejecucion", async () => {
        const pendiente = montar(new Deferred<IContextoHeartbeat>().promise, {finita: false});
        const t0 = Date.now();
        await pendiente.hb.despedir();
        assert.ok(Date.now() - t0 < 250);

        const {carga: _c, ejecucion: _e, ...servicio} = CONTEXTO;
        const {pool, hb} = montar(Promise.resolve(servicio), {finita: false});
        await hb.despedir();
        const parado = pool.enviados.at(-1);
        assert.equal(parado?.estado, "parado");
        assert.equal("carga" in (parado ?? {}), false);
        assert.equal("ejecucion" in (parado ?? {}), false);
    });
});
