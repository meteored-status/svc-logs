/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 15:31:11 GMT
 * Hash: 89ec7323304a7e35a1086621ad383956
 * Versión: 2026.11.16+4-bixus
 * Anterior: 2026.11.16+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {EventEmitter} from "node:events";
import {mkdtemp, rm, stat, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {avisos, limpiarAvisos} from "./stubs/log";
import {NOMBRE_LOCK_APAGADO} from "../engine/lock";
import type {IServidorCierre} from "../heartbeat/registro";
import {CLAVE_HEARTBEAT_NEXT, type IConfigIniciarNext, type IIniciadoNext, iniciarHeartbeatNextCon} from "../heartbeat/next/iniciar-next";
import type {IProcesoCierre} from "../heartbeat/next/cierre-next";
import {MARGEN_SONDA_MS} from "../heartbeat/next/sonda-next";

/**
 * El arranque del heartbeat de un servicio Next: una sola vez por proceso, y si no está habilitado no instala nada.
 */

class ProcesoFalso extends EventEmitter {
    public exit: IProcesoCierre["exit"];

    public constructor() {
        super();
        this.exit = (() => undefined) as unknown as IProcesoCierre["exit"];
    }
}

class EmisorFalso {
    public readonly llamadas: string[];
    public servidor: IServidorCierre|null;
    public engine: object|null;

    public constructor() {
        this.llamadas = [];
        this.servidor = null;
        this.engine = null;
    }

    public setEngine(engine: object): void {
        this.llamadas.push("setEngine");
        this.engine = engine;
    }

    public marcarEjecutado(): void {
        this.llamadas.push("marcarEjecutado");
    }

    public enlazarServidor(servidor: IServidorCierre): void {
        this.llamadas.push("enlazarServidor");
        this.servidor = servidor;
    }

    public disparar(): void {
        this.llamadas.push("disparar");
    }
}

interface IPodFalso {
    servicio: string;
}

const ENV = {HEARTBEAT: "true"};

const POD: IPodFalso = {servicio: "next"};

const esperar = async (ms: number): Promise<void> => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

const existe = async (ruta: string): Promise<boolean> => stat(ruta).then(() => true, () => false);

const conCarpeta = async (prueba: (dir: string) => Promise<void>): Promise<void> => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "iniciar-next-"));
    try {
        await prueba(dir);
    } finally {
        await rm(dir, {recursive: true, force: true});
    }
};

const creado = (emisor: EmisorFalso): IIniciadoNext => ({emisor});

describe("iniciarHeartbeatNextCon", () => {
    it("dos llamadas en el mismo proceso dan un solo emisor (guarda en el almacén)", async () => {
        await conCarpeta(async (dir) => {
            const almacen: Record<symbol, unknown> = {};
            const proceso = new ProcesoFalso();
            const emisor = new EmisorFalso();
            let pods = 0;
            const iniciadas: IConfigIniciarNext<IPodFalso>[] = [];
            const config = {
                crearPod: async () => { pods++; return POD; },
                iniciar: (c: IConfigIniciarNext<IPodFalso>) => { iniciadas.push(c); return creado(emisor); },
                adaptador: {puerto: 1, dir, intervaloLockMs: 5},
                proceso,
                almacen,
                unix: 1234,
                env: ENV,
            };

            const primera = iniciarHeartbeatNextCon(config);
            const segunda = iniciarHeartbeatNextCon(config);
            assert.equal(segunda, null);
            assert.equal(almacen[CLAVE_HEARTBEAT_NEXT], true);
            const montado = await primera;
            assert.ok(montado !== null);

            assert.equal(pods, 1);
            assert.equal(iniciadas.length, 1);
            assert.deepEqual(iniciadas[0], {pod: POD, unix: 1234, modo: "simple", timeoutSondaMs: undefined});
            assert.equal(proceso.listenerCount("SIGTERM"), 1, "un solo manejador de señal");
            assert.equal(proceso.listenerCount("SIGINT"), 1);
            montado.cierre.desinstalar();
            montado.adaptador.detener();
        });
    });

    it("habilitado: engancha el adaptador y el cierre al emisor, borra el lock viejo y avisa cuando aparece uno", async () => {
        await conCarpeta(async (dir) => {
            const lock = path.join(dir, NOMBRE_LOCK_APAGADO);
            await writeFile(lock, "");
            const emisor = new EmisorFalso();
            const montado = await iniciarHeartbeatNextCon({
                crearPod: async () => POD,
                iniciar: () => creado(emisor),
                adaptador: {puerto: 1, dir, intervaloLockMs: 5},
                proceso: new ProcesoFalso(),
                almacen: {},
                env: ENV,
            });
            assert.ok(montado !== null);
            assert.deepEqual(emisor.llamadas.slice(0, 3), ["setEngine", "marcarEjecutado", "enlazarServidor"]);
            assert.equal(emisor.engine, montado.adaptador);
            assert.equal(emisor.servidor, montado.cierre);
            assert.equal(await existe(lock), false, "el lock anterior se ha borrado");

            const disparos = emisor.llamadas.filter((l) => l === "disparar").length;
            await writeFile(lock, "");
            const t0 = Date.now();
            while (!montado.adaptador.preStopSolicitado && Date.now() - t0 < 1000) {
                await esperar(5);
            }
            assert.equal(montado.adaptador.preStopSolicitado, true);
            assert.equal(emisor.llamadas.filter((l) => l === "disparar").length, disparos + 1);
            montado.cierre.desinstalar();
            montado.adaptador.detener();
        });
    });

    it("deshabilitado: no deja manejadores de señal, ni envoltorio de exit, ni sondeos, ni borra el lock", async () => {
        await conCarpeta(async (dir) => {
            const lock = path.join(dir, NOMBRE_LOCK_APAGADO);
            await writeFile(lock, "");
            const proceso = new ProcesoFalso();
            const exit = proceso.exit;
            let consultas = 0;
            let existeLock = 0;
            const montado = await iniciarHeartbeatNextCon({
                crearPod: async () => POD,
                iniciar: () => null,
                adaptador: {
                    puerto: 1,
                    dir,
                    intervaloLockMs: 5,
                    consultar: async () => { consultas++; return 200; },
                    existeLock: async () => { existeLock++; return false; },
                },
                proceso,
                almacen: {},
                env: ENV,
            });
            await esperar(40);

            assert.equal(montado, null);
            assert.equal(proceso.listenerCount("SIGTERM"), 0);
            assert.equal(proceso.listenerCount("SIGINT"), 0);
            assert.equal(proceso.exit, exit);
            assert.equal(consultas, 0);
            assert.equal(existeLock, 0, "no hay vigilante");
            assert.equal(await existe(lock), true, "el lock no se toca");
        });
    });

    it("un emisor ausente (instancia de worker) tampoco instala nada", async () => {
        const proceso = new ProcesoFalso();
        const montado = await iniciarHeartbeatNextCon({
            crearPod: async () => POD,
            iniciar: () => ({emisor: null}),
            proceso,
            almacen: {},
                env: ENV,
        });
        assert.equal(montado, null);
        assert.equal(proceso.listenerCount("SIGTERM"), 0);
    });

    it("un error en crearPodInfo acaba en un warning, sin rechazo, y no deja nada instalado", async () => {
        limpiarAvisos();
        const proceso = new ProcesoFalso();
        let iniciadas = 0;
        const resultado = await iniciarHeartbeatNextCon({
            crearPod: async () => { throw new Error("no hay mrpack.json"); },
            iniciar: () => { iniciadas++; return null; },
            proceso,
            almacen: {},
                env: ENV,
        });
        assert.equal(resultado, null);
        assert.equal(iniciadas, 0);
        assert.equal(proceso.listenerCount("SIGTERM"), 0);
        assert.match(avisos.join("\n"), /No se pudo arrancar el heartbeat del servicio Next.*no hay mrpack\.json/);
    });

    it("sin HEARTBEAT=true no se lee el pod ni se avisa de nada (aunque falte mrpack.json)", async () => {
        limpiarAvisos();
        let pods = 0;
        let iniciadas = 0;
        const proceso = new ProcesoFalso();
        for (const env of [{}, {HEARTBEAT: "false"}, {HEARTBEAT: ""}]) {
            const resultado = await iniciarHeartbeatNextCon({
                crearPod: async () => { pods++; throw new Error("ENOENT mrpack.json"); },
                iniciar: () => { iniciadas++; return null; },
                proceso,
                almacen: {},
                env,
            });
            assert.equal(resultado, null);
        }
        assert.equal(pods, 0);
        assert.equal(iniciadas, 0);
        assert.deepEqual(avisos, []);
        assert.equal(proceso.listenerCount("SIGTERM"), 0);
    });

    it("el plazo del sondeo llega a iniciarHeartbeat y al autosondeo", async () => {
        const emisor = new EmisorFalso();
        const iniciadas: IConfigIniciarNext<IPodFalso>[] = [];
        const vistos: number[] = [];
        const montado = await iniciarHeartbeatNextCon({
            crearPod: async () => POD,
            iniciar: (c: IConfigIniciarNext<IPodFalso>) => { iniciadas.push(c); return creado(emisor); },
            adaptador: {puerto: 1, dir: os.tmpdir() + "/no-existe-iniciar-next", consultar: async (_url, ms) => { vistos.push(ms); return 200; }},
            proceso: new ProcesoFalso(),
            almacen: {},
            env: ENV,
            timeoutSondaMs: 5000,
        });
        assert.ok(montado !== null);
        assert.equal(iniciadas[0].timeoutSondaMs, 5000);
        await montado.adaptador.ready();
        assert.deepEqual(vistos, [5000 - MARGEN_SONDA_MS]);
        montado.cierre.desinstalar();
        montado.adaptador.detener();
    });

    it("un error síncrono al iniciar el emisor también acaba en un warning", async () => {
        limpiarAvisos();
        const resultado = await iniciarHeartbeatNextCon({
            crearPod: async () => POD,
            iniciar: () => { throw new Error("socket inválido"); },
            proceso: new ProcesoFalso(),
            almacen: {},
                env: ENV,
        });
        assert.equal(resultado, null);
        assert.match(avisos.join("\n"), /socket inválido/);
    });
});
