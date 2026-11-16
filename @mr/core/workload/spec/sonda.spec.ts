/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 5ef89ed44aaf3fd6512a5be398f3c551
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Deferred} from "./stubs/promise";
import {InformanteWorker} from "../heartbeat/informante";
import type {IMensajeHeartbeatWorker} from "../heartbeat/workers";
import type {IServidorCierre} from "../heartbeat/registro";
import {Sonda} from "../heartbeat/sonda";

/**
 * La sonda de un proceso (arrancado / listo / drenando) y el informante que se la manda al primario.
 */

describe("Sonda", () => {
    it("sin engine, o con el engine pero sin ejecutar, es arrancando", async () => {
        const sonda = new Sonda();
        assert.equal((await sonda.evaluar()).estado, "arrancando");
        sonda.setEngine({started: async () => undefined});
        assert.equal((await sonda.evaluar()).estado, "arrancando");
    });

    it("started() que falla mantiene arrancando; cuando resuelve se recuerda y no se vuelve a llamar", async () => {
        let llamadas = 0;
        let falla = true;
        const sonda = new Sonda();
        sonda.setEngine({started: async () => { llamadas++; if (falla) { throw new Error("aún no"); } }});
        sonda.marcarEjecutado();
        assert.equal((await sonda.evaluar()).estado, "arrancando");
        falla = false;
        assert.equal((await sonda.evaluar()).estado, "listo");
        assert.equal((await sonda.evaluar()).estado, "listo");
        assert.equal(llamadas, 2);
    });

    it("usa el resultado de /admin/ready/ si tiene menos de 2 s, y si no llama a ready()", async () => {
        let t = 10_000;
        let llamadas = 0;
        const engine = {ready: async () => { llamadas++; }, ultimoReady: {ok: false, ts: 9_500} as {ok: boolean; ts: number}|null};
        const sonda = new Sonda({ahora: () => t});
        sonda.setEngine(engine);
        sonda.marcarEjecutado();

        assert.equal((await sonda.evaluar()).estado, "no-listo", "el resultado fresco (no ok) manda");
        assert.equal(llamadas, 0);

        t = 11_600;
        assert.equal((await sonda.evaluar()).estado, "listo", "con 2,1 s de antigüedad ya no vale: se llama a ready()");
        assert.equal(llamadas, 1);

        engine.ultimoReady = {ok: true, ts: 11_000};
        assert.equal((await sonda.evaluar()).estado, "listo");
        assert.equal(llamadas, 1);
    });

    it("un ready() que no contesta dentro del timeout es no-listo", async () => {
        const nunca = new Deferred<void>();
        const sonda = new Sonda({timeoutMs: 30});
        sonda.setEngine({ready: async () => nunca.promise});
        sonda.marcarEjecutado();
        assert.equal((await sonda.evaluar()).estado, "no-listo");
        nunca.resolve();
    });

    it("la señal o el servidor cerrando dan drenando sin llamar a ready()", async () => {
        let llamadas = 0;
        const sonda = new Sonda();
        sonda.setEngine({ready: async () => { llamadas++; }});
        sonda.marcarEjecutado();
        sonda.marcarSenal();
        assert.deepEqual(await sonda.evaluar(), {estado: "drenando", causaDrenado: "senal"});
        assert.equal(llamadas, 0);

        const otra = new Sonda();
        otra.setConsultaCierre(() => true);
        assert.deepEqual(await otra.evaluar(), {estado: "drenando", causaDrenado: "senal"});
    });
});

describe("InformanteWorker", () => {
    const turno = async (): Promise<void> => {
        for (let i = 0; i < 5; i++) {
            await new Promise<void>((resolve) => setImmediate(resolve));
        }
    };

    it("informa por IPC del estado del worker y de cada cambio", async () => {
        const mensajes: IMensajeHeartbeatWorker[] = [];
        const informante = new InformanteWorker({sonda: new Sonda(), enviar: (m) => { mensajes.push(m); }, intervaloMs: 1_000_000});
        informante.setEngine({});
        await turno();
        informante.marcarEjecutado();
        await turno();
        assert.deepEqual(mensajes.map((m) => m.estado), ["arrancando", "listo"]);
        assert.ok(mensajes.every((m) => m.cmd === "heartbeat"));
    });

    it("con el servidor cerrando por señal informa drenando de inmediato", async () => {
        const mensajes: IMensajeHeartbeatWorker[] = [];
        const informante = new InformanteWorker({sonda: new Sonda(), enviar: (m) => { mensajes.push(m); }, intervaloMs: 1_000_000});
        let inicio: () => void = () => undefined;
        let salida: () => Promise<void> = async () => undefined;
        const servidor: IServidorCierre = {isShuttingDown: () => false, alIniciarCierre: (cb) => { inicio = cb; }, antesDeSalir: (cb) => { salida = cb; }};
        informante.enlazarServidor(servidor);
        informante.setEngine({});
        informante.marcarEjecutado();
        await turno();

        inicio();
        await turno();
        assert.deepEqual(mensajes.at(-1), {cmd: "heartbeat", estado: "drenando", causaDrenado: "senal"});
        await salida();
    });
});
