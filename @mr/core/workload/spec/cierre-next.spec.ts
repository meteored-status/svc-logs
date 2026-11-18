/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 13:26:05 GMT
 * Hash: e6648729a98cda85fde2f799ec5f94c1
 * Versión: 2026.11.16+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {EventEmitter} from "node:events";
import path from "node:path";

import {avisos, limpiarAvisos} from "./stubs/log";
import {DESPEDIDA_MAX_MS} from "../heartbeat/cierre-primario";
import {type IProcesoCierre, ServidorCierreNext} from "../heartbeat/next/cierre-next";

/**
 * El cierre de un servicio Next: SIGTERM/SIGINT marcan `drenando` y `process.exit` (el de Next) espera como mucho 1 s a la
 * despedida y sale con el mismo código.
 */

class ProcesoFalso extends EventEmitter {
    public exit: IProcesoCierre["exit"];
    public readonly salidas: (number|string|null|undefined)[];

    public constructor(alSalir: (codigo: number|string|null|undefined) => void = () => undefined) {
        super();
        this.salidas = [];
        this.exit = ((codigo?: number|string|null) => {
            this.salidas.push(codigo);
            alSalir(codigo);
        }) as IProcesoCierre["exit"];
    }
}

const esperar = async (ms: number): Promise<void> => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

/** Hace de manejador de Next: cierra en una tarea posterior y termina con `process.exit(codigo)`. */
const comoNext = (proceso: ProcesoFalso, senal: "SIGTERM"|"SIGINT", codigo: number): void => {
    proceso.on(senal, () => {
        setTimeout(() => { proceso.exit(codigo); }, 5);
    });
};

describe("ServidorCierreNext: señal", () => {
    for (const senal of ["SIGTERM", "SIGINT"] as const) {
        it(`${senal} marca isShuttingDown y llama a alIniciarCierre`, () => {
            const proceso = new ProcesoFalso();
            comoNext(proceso, senal, 143);
            const cierre = new ServidorCierreNext({proceso});
            const llamadas: string[] = [];
            cierre.alIniciarCierre(() => { llamadas.push("a"); });
            cierre.alIniciarCierre(() => { llamadas.push("b"); });
            cierre.instalar();
            assert.equal(cierre.isShuttingDown(), false);

            proceso.emit(senal);
            assert.equal(cierre.isShuttingDown(), true);
            assert.deepEqual(llamadas, ["a", "b"]);

            proceso.emit(senal);
            assert.deepEqual(llamadas, ["a", "b"], "la segunda señal no repite el aviso");
            cierre.desinstalar();
        });
    }

    it("un alIniciarCierre que lanza no impide el resto ni el envoltorio", () => {
        limpiarAvisos();
        const proceso = new ProcesoFalso();
        comoNext(proceso, "SIGTERM", 143);
        const original = proceso.exit;
        const cierre = new ServidorCierreNext({proceso});
        const llamadas: string[] = [];
        cierre.alIniciarCierre(() => { throw new Error("falla"); });
        cierre.alIniciarCierre(() => { llamadas.push("b"); });
        cierre.instalar();
        proceso.emit("SIGTERM");
        assert.deepEqual(llamadas, ["b"]);
        assert.match(avisos.join("\n"), /falla/);
        assert.notEqual(proceso.exit, original, "se ha envuelto");
        cierre.desinstalar();
    });

    it("antes de la señal no se envuelve nada: ni process.exit ni nada más", () => {
        const proceso = new ProcesoFalso();
        const original = proceso.exit;
        const cierre = new ServidorCierreNext({proceso});
        cierre.instalar();
        cierre.instalar();
        assert.equal(proceso.exit, original);
        assert.equal(proceso.listenerCount("SIGTERM"), 1, "instalar() es idempotente");
        assert.equal(proceso.listenerCount("SIGINT"), 1);
        cierre.desinstalar();
        assert.equal(proceso.listenerCount("SIGTERM"), 0);
    });

    it("desinstalar devuelve process.exit a su sitio tras la señal", () => {
        const proceso = new ProcesoFalso();
        comoNext(proceso, "SIGTERM", 143);
        const original = proceso.exit;
        const cierre = new ServidorCierreNext({proceso});
        cierre.instalar();
        proceso.emit("SIGTERM");
        assert.notEqual(proceso.exit, original);
        cierre.desinstalar();
        assert.equal(proceso.exit, original);
    });
});

describe("ServidorCierreNext: salida", () => {
    for (const codigo of [143, 0]) {
        it(`la despedida va antes del exit real, que sale con el mismo código (${codigo})`, async () => {
            const orden: string[] = [];
            const proceso = new ProcesoFalso((c) => { orden.push(`exit:${c}`); });
            comoNext(proceso, "SIGTERM", codigo);
            const cierre = new ServidorCierreNext({proceso});
            cierre.alIniciarCierre(() => { orden.push("drenando"); });
            cierre.antesDeSalir(async () => { orden.push("despedir-inicio"); await esperar(20); orden.push("despedir-fin"); });
            cierre.instalar();

            proceso.emit("SIGTERM");
            await esperar(150);
            assert.deepEqual(orden, ["drenando", "despedir-inicio", "despedir-fin", `exit:${codigo}`]);
            cierre.desinstalar();
        });
    }

    it("el exit real recibe tal cual el argumento (sin argumento, el exitCode del proceso)", async () => {
        const proceso = new ProcesoFalso();
        proceso.on("SIGTERM", () => { setTimeout(() => { proceso.exit(); }, 5); });
        const cierre = new ServidorCierreNext({proceso});
        cierre.instalar();
        proceso.emit("SIGTERM");
        await esperar(60);
        assert.deepEqual(proceso.salidas, [undefined]);
        cierre.desinstalar();
    });

    it("una despedida que no resuelve nunca sale igual, dentro del tope, y avisa", async () => {
        limpiarAvisos();
        const proceso = new ProcesoFalso();
        comoNext(proceso, "SIGTERM", 143);
        const cierre = new ServidorCierreNext({proceso, despedidaMs: 60});
        cierre.antesDeSalir(async () => new Promise<void>(() => undefined));
        cierre.instalar();

        const t0 = Date.now();
        proceso.emit("SIGTERM");
        while (proceso.salidas.length === 0 && Date.now() - t0 < 2000) {
            await esperar(5);
        }
        const tardado = Date.now() - t0;
        assert.deepEqual(proceso.salidas, [143]);
        assert.ok(tardado >= 55 && tardado < 400, `tardó ${tardado} ms`);
        assert.match(avisos.join("\n"), /no terminó en 60 ms/);
        cierre.desinstalar();
    });

    it("el tope por defecto es el de 1 s de la despedida del primario", async () => {
        assert.equal(DESPEDIDA_MAX_MS, 1000);
        const proceso = new ProcesoFalso();
        comoNext(proceso, "SIGTERM", 143);
        const cierre = new ServidorCierreNext({proceso});
        cierre.antesDeSalir(async () => new Promise<void>(() => undefined));
        cierre.instalar();
        const t0 = Date.now();
        proceso.emit("SIGTERM");
        while (proceso.salidas.length === 0 && Date.now() - t0 < 3000) {
            await esperar(20);
        }
        const tardado = Date.now() - t0;
        assert.ok(tardado >= 950 && tardado < 1400, `tardó ${tardado} ms`);
        cierre.desinstalar();
    });

    it("es idempotente: dos exit dan una sola despedida y un solo exit real", async () => {
        let despedidas = 0;
        const proceso = new ProcesoFalso();
        proceso.on("SIGTERM", () => {
            setTimeout(() => { proceso.exit(143); proceso.exit(1); }, 5);
        });
        const cierre = new ServidorCierreNext({proceso});
        cierre.antesDeSalir(async () => { despedidas++; await esperar(20); });
        cierre.instalar();
        proceso.emit("SIGTERM");
        await esperar(120);
        assert.equal(despedidas, 1);
        assert.deepEqual(proceso.salidas, [143], "gana la primera llamada, la de Next");
        cierre.desinstalar();
    });

    it("sin heartbeat que despedir (ningún antesDeSalir) también sale con el mismo código", async () => {
        const proceso = new ProcesoFalso();
        comoNext(proceso, "SIGINT", 130);
        const cierre = new ServidorCierreNext({proceso});
        cierre.instalar();
        proceso.emit("SIGINT");
        await esperar(60);
        assert.deepEqual(proceso.salidas, [130]);
        cierre.desinstalar();
    });

    it("si nadie más atiende la señal, sale él con 128 + n tras la despedida (como la acción por defecto de Node)", async () => {
        const orden: string[] = [];
        const proceso = new ProcesoFalso((c) => { orden.push(`exit:${c}`); });
        const cierre = new ServidorCierreNext({proceso});
        cierre.antesDeSalir(async () => { orden.push("despedir"); });
        cierre.instalar();
        proceso.emit("SIGTERM");
        await esperar(60);
        assert.deepEqual(orden, ["despedir", "exit:143"]);

        const otro = new ProcesoFalso((c) => { orden.push(`exit2:${c}`); });
        const cierreInt = new ServidorCierreNext({proceso: otro});
        cierreInt.instalar();
        otro.emit("SIGINT");
        await esperar(60);
        assert.deepEqual(orden.slice(2), ["exit2:130"]);
        cierre.desinstalar();
        cierreInt.desinstalar();
    });

    it("si otro manejador atiende la señal, no sale hasta que lo haga el exit de ese manejador", async () => {
        const proceso = new ProcesoFalso();
        proceso.on("SIGTERM", () => undefined);
        const cierre = new ServidorCierreNext({proceso});
        cierre.instalar();
        proceso.emit("SIGTERM");
        await esperar(80);
        assert.deepEqual(proceso.salidas, []);
        cierre.desinstalar();
    });
});

describe("ServidorCierreNext: proceso real", () => {
    it("con el bucle de eventos vacío durante la despedida, sale con el código de Next y no con 0", async () => {
        // Un proceso de verdad: «Next» cierra y llama a process.exit(143) tras la señal; la despedida no resuelve nunca y no queda
        // nada más con referencia, así que sin el temporizador con referencia Node saldría solo, con 0.
        const codigo = `
            require(process.env.STUBS);
            const {ServidorCierreNext} = require(process.env.CIERRE);
            const vivo = setInterval(() => undefined, 1000);
            process.on("SIGTERM", () => { clearInterval(vivo); setTimeout(() => process.exit(143), 30); });
            const cierre = new ServidorCierreNext({despedidaMs: 400});
            cierre.antesDeSalir(() => new Promise(() => undefined));
            cierre.instalar();
            process.stdout.write("listo\\n");
        `;
        const hijo = spawn(process.execPath, ["-e", codigo], {
            env: {
                ...process.env,
                STUBS: path.join(__dirname, "stubs/instalar.js"),
                CIERRE: path.join(__dirname, "../heartbeat/next/cierre-next.js"),
            },
            stdio: ["ignore", "pipe", "inherit"],
        });
        const listo = new Promise<void>((resolve) => { hijo.stdout.once("data", () => { resolve(); }); });
        const salida = new Promise<{codigo: number|null; senal: NodeJS.Signals|null}>((resolve) => {
            hijo.once("exit", (c, s) => { resolve({codigo: c, senal: s}); });
        });
        await listo;
        const t0 = Date.now();
        hijo.kill("SIGTERM");
        const {codigo: salio, senal} = await salida;
        const tardado = Date.now() - t0;

        assert.equal(senal, null);
        assert.equal(salio, 143);
        assert.ok(tardado >= 380, `salió a los ${tardado} ms: no esperó a la despedida`);
    });
});
