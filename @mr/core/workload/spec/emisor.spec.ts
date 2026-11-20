/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: 70f321cf67724054326fc2413ef26147
 * Versión: 2026.11.20+1-bixus
 * Anterior: 2026.11.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {EEntorno} from "@mr/core-log/interface";

import {avisos, infos, limpiarAvisos} from "./stubs/log";
import {Deferred} from "./stubs/promise";
import {Heartbeat, type IPoolHeartbeat, PRIMER_ESTADO_MAX_MS} from "../heartbeat/emisor";
import type {TRespuestaPool} from "../heartbeat/despedida";
import {type IHeartbeat, METODO_HEARTBEAT_CONFIRMADO} from "../heartbeat/interface";
import type {ILecturaEstado} from "../heartbeat/estado";
import type {IServidorCierre} from "../heartbeat/registro";
import {Sonda} from "../heartbeat/sonda";

/**
 * El emisor con un pool falso: un solo envío en vuelo (gana la última foto), cuenta de `seq` y `tseq`,
 * envío inmediato al cambiar el estado y la despedida: el `parado` sale con `get()` (confirmación), sin esperar a un ciclo atascado.
 */

const CONTEXTO = {
    entorno: EEntorno.PRODUCCION, proyectoGcp: "p", cluster: "c", ubicacion: "u", zona: "z", namespace: "n", pod: "pod-1",
    servicio: "n/svc", producto: "", departamento: "", version: "1", revision: "r1", inicio: 1,
};

/** Cede el turno hasta que se vacían las microtareas y los `setImmediate` pendientes. */
const turno = async (): Promise<void> => {
    for (let i = 0; i < 5; i++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
};

const CONFIRMADO: TRespuestaPool = {ok: true, data: {v: 1, resultado: "confirmado"}};
const REINTENTAR: TRespuestaPool = {ok: true, data: {v: 1, resultado: "reintentar"}};

class PoolFalso implements IPoolHeartbeat {
    public readonly enviados: IHeartbeat[] = [];
    public readonly orden: string[] = [];
    public readonly metodos: string[] = [];
    public pendientes: Deferred<void>[] = [];
    public respuestasGet: (TRespuestaPool|Error)[] = [];
    public bloquear = false;
    public fallar = false;
    public colgarVaciar = false;
    public readonly vaciados: (number|undefined)[] = [];

    public async get<T>(metodo: string, params?: T): Promise<TRespuestaPool> {
        this.orden.push("get");
        this.metodos.push(metodo);
        this.enviados.push(params as unknown as IHeartbeat);
        const respuesta = this.respuestasGet.shift() ?? CONFIRMADO;
        if (respuesta instanceof Error) {
            throw respuesta;
        }

        return respuesta;
    }

    public async head<T>(_metodo: string, params?: T): Promise<void> {
        this.orden.push("head");
        this.enviados.push(params as unknown as IHeartbeat);
        if (this.fallar) {
            throw new Error("circuit open");
        }
        if (this.bloquear) {
            const d = new Deferred<void>();
            this.pendientes.push(d);
            await d.promise;
        }
    }

    public async vaciar(config?: {timeoutMs?: number}): Promise<void> {
        this.orden.push("vaciar");
        this.vaciados.push(config?.timeoutMs);
        if (this.colgarVaciar) {
            await new Deferred<void>().promise;
        }
    }

    public destroy(): void {
        this.orden.push("destroy");
    }
}

function montar(extra: {fuente?: () => ILecturaEstado; ahora?: () => number; sonda?: Sonda} = {}) {
    const pool = new PoolFalso();
    const nuevos: PoolFalso[] = [];
    const sonda = extra.sonda ?? new Sonda();
    const hb = new Heartbeat({
        contexto: Promise.resolve(CONTEXTO),
        pool,
        abrirNuevo: () => {
            const nuevo = new PoolFalso();
            nuevos.push(nuevo);

            return nuevo;
        },
        sonda,
        fuente: extra.fuente,
        metricas: () => ({rss: 1, loopP99: 0, loopMax: 0, uptime: 1}),
        ahora: extra.ahora,
        intervaloMs: 1_000_000,
    });

    return {pool, nuevos, sonda, hb};
}

describe("Heartbeat: un solo envío en vuelo", () => {
    it("mientras uno no resuelve se saltan los ticks y al resolver se manda solo la última foto", async () => {
        let lectura: ILecturaEstado = {estado: "arrancando", causaDrenado: null};
        const {pool, hb} = montar({fuente: () => lectura});
        pool.bloquear = true;

        hb.disparar();
        await turno();
        assert.equal(pool.enviados.length, 1);

        lectura = {estado: "listo", causaDrenado: null};
        hb.disparar();
        lectura = {estado: "no-listo", causaDrenado: null};
        hb.disparar();
        hb.disparar();
        await turno();
        assert.equal(pool.enviados.length, 1, "no se manda nada mientras el anterior no resuelve");

        pool.bloquear = false;
        pool.pendientes[0]?.resolve();
        await turno();
        assert.equal(pool.enviados.length, 2, "tres peticiones acumuladas, un solo envío");
        assert.equal(pool.enviados[1]?.estado, "no-listo", "gana la última foto, la intermedia se descarta");
        assert.equal(pool.enviados[1]?.seq, 2);
    });

    it("si head() lanza, se descarta, sigue funcionando y solo avisa una vez por minuto", async () => {
        limpiarAvisos();
        let t = 1_000_000;
        const {pool, hb} = montar({fuente: () => ({estado: "listo", causaDrenado: null}), ahora: () => t});
        pool.fallar = true;

        hb.disparar();
        await turno();
        t += 1000;
        hb.disparar();
        await turno();
        assert.equal(pool.enviados.length, 2);
        assert.equal(avisos.length, 1, "dos descartes seguidos, un aviso");

        t += 60_000;
        hb.disparar();
        await turno();
        assert.equal(avisos.length, 2, "pasado un minuto vuelve a avisar");

        pool.fallar = false;
        hb.disparar();
        await turno();
        assert.equal(pool.enviados.length, 4);
        assert.equal(pool.enviados[3]?.seq, 4, "seq crece también con lo descartado: el hueco se ve en el receptor");
    });
});

describe("Heartbeat: seq, tseq y transiciones", () => {
    it("solo cuenta transiciones cuando cambia el estado", async () => {
        let lectura: ILecturaEstado = {estado: "arrancando", causaDrenado: null};
        let t = 100;
        const {pool, hb} = montar({fuente: () => lectura, ahora: () => t});

        const enviar = async (l: ILecturaEstado): Promise<void> => {
            lectura = l;
            t += 10;
            hb.disparar();
            await turno();
        };
        await enviar({estado: "arrancando", causaDrenado: null});
        await enviar({estado: "arrancando", causaDrenado: null});
        await enviar({estado: "listo", causaDrenado: null});
        await enviar({estado: "listo", causaDrenado: null});
        await enviar({estado: "no-listo", causaDrenado: null});

        assert.deepEqual(pool.enviados.map((h) => h.seq), [1, 2, 3, 4, 5]);
        assert.deepEqual(pool.enviados.map((h) => h.tseq), [0, 0, 1, 1, 2]);
        assert.deepEqual(pool.enviados.map((h) => h.anterior), [null, null, "arrancando", "arrancando", "listo"]);
        assert.equal(pool.enviados[2]?.desde, 130, "desde es la hora de la transición");
        assert.equal(pool.enviados[3]?.desde, 130, "y no cambia mientras el estado no cambie");
    });

    it("el procesos del agregado llega al mensaje", async () => {
        const {pool, hb} = montar({fuente: () => ({estado: "listo", causaDrenado: null, procesos: {total: 4, listos: 4}})});
        hb.disparar();
        await turno();
        assert.deepEqual(pool.enviados[0]?.procesos, {total: 4, listos: 4});
    });
});

describe("Heartbeat: envío inmediato con la sonda real", () => {
    it("manda al cambiar el estado sin esperar al temporizador", async () => {
        const {pool, hb} = montar();
        hb.setEngine({started: async () => undefined, ready: async () => undefined});
        await turno();
        assert.equal(pool.enviados.at(-1)?.estado, "arrancando", "el engine existe pero ejecutar() no ha resuelto");

        hb.marcarEjecutado();
        await turno();
        assert.equal(pool.enviados.at(-1)?.estado, "listo");
        assert.equal(pool.enviados.at(-1)?.tseq, 1);
    });

    it("el preStop da drenando con causa prestop", async () => {
        const {pool, hb} = montar();
        const engine = {started: async () => undefined, ready: async () => undefined, preStopSolicitado: false};
        hb.setEngine(engine);
        hb.marcarEjecutado();
        await turno();
        assert.equal(pool.enviados.at(-1)?.estado, "listo");

        engine.preStopSolicitado = true;
        hb.disparar();
        await turno();
        assert.equal(pool.enviados.at(-1)?.estado, "drenando");
        assert.equal(pool.enviados.at(-1)?.causaDrenado, "prestop");
    });

    it("la señal da drenando con causa senal, aunque el preStop ya hubiera llegado", async () => {
        const {pool, hb} = montar();
        hb.setEngine({started: async () => undefined, ready: async () => undefined, preStopSolicitado: true});
        hb.marcarEjecutado();
        await turno();
        assert.equal(pool.enviados.at(-1)?.causaDrenado, "prestop");

        hb.alIniciarCierre();
        await turno();
        assert.equal(pool.enviados.at(-1)?.causaDrenado, "senal");
    });

    it("enlazarServidor registra los callbacks; con el servidor ya cerrando el estado es drenando", async () => {
        const {pool, hb} = montar();
        let cerrando = false;
        let inicio: (() => void)|undefined;
        let salida: (() => Promise<void>)|undefined;
        const servidor: IServidorCierre = {
            isShuttingDown: () => cerrando,
            alIniciarCierre: (cb) => { inicio = cb; },
            antesDeSalir: (cb) => { salida = cb; },
        };
        hb.enlazarServidor(servidor);
        hb.setEngine({});
        hb.marcarEjecutado();
        await turno();
        assert.equal(pool.enviados.at(-1)?.estado, "listo", "un engine sin sondas HTTP es listo al ejecutar");

        cerrando = true;
        hb.disparar();
        await turno();
        assert.equal(pool.enviados.at(-1)?.estado, "drenando");
        assert.equal(pool.enviados.at(-1)?.causaDrenado, "senal");
        assert.ok(inicio && salida);
    });

    it("sin arrancar el engine ready() no se llama, y un ready() que falla da no-listo", async () => {
        let llamadas = 0;
        const sonda = new Sonda();
        const {pool, hb} = montar({sonda});
        hb.setEngine({started: async () => undefined, ready: async () => { llamadas++; throw new Error("elastic"); }});
        await turno();
        assert.equal(llamadas, 0);
        hb.marcarEjecutado();
        await turno();
        assert.equal(pool.enviados.at(-1)?.estado, "no-listo");
    });
});

describe("Heartbeat: temporizador y despedida", () => {
    it("el temporizador manda sin que nadie dispare", async () => {
        const pool = new PoolFalso();
        const hb = new Heartbeat({
            contexto: Promise.resolve(CONTEXTO), pool, abrirNuevo: () => new PoolFalso(), sonda: new Sonda(),
            fuente: () => ({estado: "listo", causaDrenado: null}),
            metricas: () => ({rss: 1, loopP99: 0, loopMax: 0, uptime: 1}),
            intervaloMs: 10,
        });
        hb.iniciar();
        await new Promise<void>((resolve) => setTimeout(resolve, 80));
        await hb.despedir();
        assert.ok(pool.enviados.length >= 3, `solo ${pool.enviados.length} envíos`);
    });

    it("despedir manda parado con get() de confirmación y destruye el pool, y después no se manda nada más", async () => {
        let lectura: ILecturaEstado = {estado: "drenando", causaDrenado: "senal"};
        const {pool, hb} = montar({fuente: () => lectura});
        hb.disparar();
        await turno();

        await hb.despedir();
        assert.deepEqual(pool.orden.slice(-3), ["head", "get", "destroy"]);
        assert.equal(pool.metodos.at(-1), METODO_HEARTBEAT_CONFIRMADO);
        const ultimo = pool.enviados.at(-1);
        assert.equal(ultimo?.estado, "parado");
        assert.equal(ultimo?.anterior, "drenando");
        assert.equal(ultimo?.causaDrenado, "senal", "la causa del drenado se conserva en la despedida");
        assert.equal(ultimo?.seq, pool.enviados.length, "la despedida también consume seq");
        assert.equal(ultimo?.tseq, 2, "arrancando → drenando → parado");

        const total = pool.enviados.length;
        lectura = {estado: "listo", causaDrenado: null};
        hb.disparar();
        await turno();
        assert.equal(pool.enviados.length, total);
    });

    it("despedir con un envío en vuelo que acaba pronto lo espera: el parado va después de él", async () => {
        const {pool, hb} = montar({fuente: () => ({estado: "listo", causaDrenado: null})});
        pool.bloquear = true;
        hb.disparar();
        await turno();
        assert.equal(pool.enviados.length, 1);

        const despedida = hb.despedir();
        await turno();
        assert.equal(pool.orden.includes("get"), false, "aún no ha salido: el envío en vuelo no ha resuelto");
        pool.bloquear = false;
        pool.pendientes[0]?.resolve();
        await despedida;
        // El primer envío es la foto de `arrancando` que se entrega antes de la primera transición; la de `listo` no sale: la despedida manda ya.
        assert.deepEqual(pool.enviados.map((h) => h.estado), ["arrancando", "parado"]);
        assert.deepEqual(pool.orden.slice(-2), ["get", "destroy"]);
        assert.ok(pool.enviados[0]!.seq < pool.enviados[1]!.seq);
    });

    it("regresión del 2026-11-18: con un ciclo atascado en head() el parado sale en menos de 150 ms", async () => {
        // Medido en producción: `head()` esperando una reconexión (hasta 5 s) y la despedida esperando a ese ciclo agotaban el
        // presupuesto de 1 s de `antesDeSalir` sin haber mandado nada.
        const {pool, hb} = montar({fuente: () => ({estado: "drenando", causaDrenado: "senal"})});
        pool.bloquear = true;
        hb.disparar();
        await turno();
        assert.equal(pool.enviados.length, 1);

        const t0 = Date.now();
        await hb.despedir();
        const ms = Date.now() - t0;
        assert.ok(ms < 150, `la despedida tardó ${ms} ms`);
        assert.equal(pool.enviados.at(-1)?.estado, "parado");
        assert.equal(pool.metodos.at(-1), METODO_HEARTBEAT_CONFIRMADO);
        assert.equal(pool.orden.at(-1), "destroy");

        // El ciclo atascado, si algún día resuelve, no manda nada detrás del parado.
        const total = pool.enviados.length;
        pool.bloquear = false;
        pool.pendientes[0]?.resolve();
        await turno();
        assert.equal(pool.enviados.length, total);
    });

    it("el parado se construye una vez: si el receptor pide reintentar, el pool nuevo recibe el mismo mensaje (mismo seq)", async () => {
        limpiarAvisos();
        const {pool, nuevos, hb} = montar({fuente: () => ({estado: "drenando", causaDrenado: "senal"})});
        hb.disparar();
        await turno();
        pool.respuestasGet.push(REINTENTAR);

        await hb.despedir();
        assert.equal(nuevos.length, 1);
        assert.deepEqual(nuevos[0]?.enviados, [pool.enviados.at(-1)]);
        assert.equal(nuevos[0]?.enviados[0]?.estado, "parado");
        assert.deepEqual(nuevos[0]?.orden, ["get", "destroy"]);
        assert.equal(pool.orden.at(-1), "destroy");
        assert.equal(infos.length, 1, "confirmada en el intento 2: una línea info para medir");
        assert.match(infos[0] ?? "", /intento 2/);
        assert.equal(avisos.length, 0);
    });

    it("si ningún intento se confirma, un warning con el motivo", async () => {
        limpiarAvisos();
        const pool = new PoolFalso();
        pool.respuestasGet.push(new Error("circuit open"));
        // Los pools nuevos tampoco confirman (sin respuesta programada confirmarían).
        const sinConfirmar = new Heartbeat({
            contexto: Promise.resolve(CONTEXTO), pool, sonda: new Sonda(), fuente: () => ({estado: "listo", causaDrenado: null}), metricas: () => ({rss: 1, loopP99: 0, loopMax: 0, uptime: 1}), intervaloMs: 1_000_000,
            abrirNuevo: () => {
                const nuevo = new PoolFalso();
                nuevo.respuestasGet.push(REINTENTAR);

                return nuevo;
            },
            presupuestoDespedidaMs: 100,
        });
        await sinConfirmar.despedir();
        assert.equal(avisos.length, 1);
        assert.match(avisos[0] ?? "", /no se ha confirmado/);
        assert.equal(pool.orden.at(-1), "destroy");
    });

    it("despedir no espera a un ready() lento: la despedida entra en el presupuesto de 1 s", async () => {
        const lento = new Deferred<void>();
        const sonda = new Sonda({timeoutMs: 5000});
        const {pool, hb} = montar({sonda});
        hb.setEngine({started: async () => undefined, ready: async () => lento.promise});
        hb.marcarEjecutado();
        await turno();

        const t0 = Date.now();
        await hb.despedir();
        lento.resolve();
        assert.ok(Date.now() - t0 < 500);
        assert.equal(pool.enviados.at(-1)?.estado, "parado");
    });

    it("despedir es idempotente", async () => {
        const {pool, hb} = montar({fuente: () => ({estado: "listo", causaDrenado: null})});
        await Promise.all([hb.despedir(), hb.despedir()]);
        await hb.despedir();
        assert.equal(pool.orden.filter((o) => o === "destroy").length, 1);
        assert.equal(pool.enviados.filter((h) => h.estado === "parado").length, 1);
    });
});

describe("Heartbeat: contexto que tarda (metadatos de GKE en producción)", () => {
    it("no emite nada hasta que el contexto resuelve, y entonces manda el estado actual", async () => {
        const pool = new PoolFalso();
        const contexto = new Deferred<typeof CONTEXTO>();
        const hb = new Heartbeat({contexto: contexto.promise, pool, abrirNuevo: () => new PoolFalso(), sonda: new Sonda(), metricas: () => ({rss: 1, loopP99: 0, loopMax: 0, uptime: 1}), intervaloMs: 1_000_000});
        hb.disparar();
        hb.disparar();
        await turno();
        assert.equal(pool.enviados.length, 0);

        contexto.resolve(CONTEXTO);
        await turno();
        assert.equal(pool.enviados.length, 1);
        assert.equal(pool.enviados[0]?.cluster, "c");
        assert.equal(pool.enviados[0]?.revision, "r1");
    });

    it("despedir con el contexto aún pendiente no se queda esperándolo: cierra el pool y no manda parado", async () => {
        const pool = new PoolFalso();
        const hb = new Heartbeat({contexto: new Deferred<typeof CONTEXTO>().promise, pool, abrirNuevo: () => new PoolFalso(), sonda: new Sonda(), metricas: () => ({rss: 1, loopP99: 0, loopMax: 0, uptime: 1}), intervaloMs: 1_000_000});
        hb.disparar();
        await turno();

        const limite = new Promise<string>((resolve) => setTimeout(() => resolve("colgado"), 500));
        assert.equal(await Promise.race([hb.despedir().then(() => "ok"), limite]), "ok");
        assert.deepEqual(pool.orden, ["vaciar", "destroy"]);
    });
});

describe("Heartbeat: el primer estado se entrega antes que cualquier transición", () => {
    it("un pod que ya está listo en su primer envío manda antes arrancando con tseq 0", async () => {
        // Medido en status-backend en modo simple: el receptor veía primero tseq 1 y se perdía null → arrancando.
        const {pool, hb} = montar({fuente: () => ({estado: "listo", causaDrenado: null})});
        hb.disparar();
        await turno();
        assert.deepEqual(pool.enviados.map((h) => [h.estado, h.anterior, h.tseq, h.seq]), [["arrancando", null, 0, 1], ["listo", "arrancando", 1, 2]]);
        hb.disparar();
        await turno();
        assert.deepEqual(pool.enviados.map((h) => h.estado), ["arrancando", "listo", "listo"], "una vez entregado no se repite");
    });

    it("si el primer estado no se entrega, no se manda la transición: sale todo en el siguiente ciclo", async () => {
        let t = 1000;
        const {pool, hb} = montar({fuente: () => ({estado: "listo", causaDrenado: null}), ahora: () => t});
        pool.fallar = true;
        hb.disparar();
        await turno();
        assert.deepEqual(pool.enviados.map((h) => [h.estado, h.tseq]), [["arrancando", 0]], "sin la foto de tseq 1 detrás");
        pool.fallar = false;
        t += 1000;
        hb.disparar();
        await turno();
        assert.deepEqual(pool.enviados.slice(1).map((h) => [h.estado, h.tseq, h.desde]), [["arrancando", 0, 1000], ["listo", 1, 1000]]);
    });

    it("pasado PRIMER_ESTADO_MAX_MS ya no se insiste; y si el primero ya salió como arrancando, no se repite", async () => {
        let t = 1000;
        const {pool, hb} = montar({fuente: () => ({estado: "listo", causaDrenado: null}), ahora: () => t});
        t += PRIMER_ESTADO_MAX_MS;
        hb.disparar();
        await turno();
        assert.deepEqual(pool.enviados.map((h) => h.tseq), [1]);

        let lectura: ILecturaEstado = {estado: "arrancando", causaDrenado: null};
        const otro = montar({fuente: () => lectura});
        otro.hb.disparar();
        await turno();
        lectura = {estado: "listo", causaDrenado: null};
        otro.hb.disparar();
        await turno();
        assert.deepEqual(otro.pool.enviados.map((h) => [h.estado, h.tseq]), [["arrancando", 0], ["listo", 1]]);
    });

    it("la despedida no se queda esperando al primer estado", async () => {
        const {pool, hb} = montar({fuente: () => ({estado: "listo", causaDrenado: null})});
        pool.fallar = true;
        await hb.despedir();
        assert.deepEqual(pool.enviados.map((h) => h.estado), ["parado"]);
    });
});

describe("Heartbeat: esperar al primer envío (arranque fallido)", () => {
    it("sin iniciar no manda nada y vuelve al agotarse el tope", async () => {
        const {pool, hb} = montar();
        const t0 = Date.now();
        await hb.esperarPrimerEnvio(60);
        assert.ok(Date.now() - t0 >= 50, "esperó el tope");
        assert.equal(pool.enviados.length, 0, "no manda por su cuenta");
    });

    it("vuelve en cuanto el primer envío sale, mucho antes del tope", async () => {
        const {pool, hb} = montar();
        hb.iniciar();
        const t0 = Date.now();
        await hb.esperarPrimerEnvio(5000);
        assert.ok(Date.now() - t0 < 1000, "no esperó al tope");
        assert.equal(pool.enviados[0]?.estado, "arrancando");
        assert.equal(pool.enviados[0]?.tseq, 0);
    });

    it("un envío descartado (head lanza) también la libera", async () => {
        limpiarAvisos();
        const {pool, hb} = montar();
        pool.fallar = true;
        hb.iniciar();
        const t0 = Date.now();
        await hb.esperarPrimerEnvio(5000);
        assert.ok(Date.now() - t0 < 1000);
    });

    it("con el envío colgado vuelve al agotarse el tope, no antes", async () => {
        const {pool, hb} = montar();
        pool.bloquear = true;
        hb.iniciar();
        const t0 = Date.now();
        await hb.esperarPrimerEnvio(80);
        const ms = Date.now() - t0;
        assert.ok(ms >= 70 && ms < 1000, `ms=${ms}`);
    });

    it("no vuelve hasta que el frame ha salido del proceso: vacía el buffer tras el envío, con lo que quede del tope", async () => {
        const {pool, hb} = montar();
        hb.iniciar();
        await hb.esperarPrimerEnvio(1000);
        assert.deepEqual(pool.orden.slice(0, 2), ["head", "vaciar"], "primero el envío y después el vaciado");
        const timeout = pool.vaciados[0];
        assert.ok(timeout !== undefined && timeout > 0 && timeout <= 1000, `timeout=${timeout}`);
    });

    it("un vaciado que no acaba no pasa del tope", async () => {
        const {pool, hb} = montar();
        pool.colgarVaciar = true;
        hb.iniciar();
        const t0 = Date.now();
        await hb.esperarPrimerEnvio(120);
        const ms = Date.now() - t0;
        assert.ok(ms >= 100 && ms < 1000, `ms=${ms}`);
    });
});
