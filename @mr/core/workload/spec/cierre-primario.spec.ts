/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 7add18ea42f820bc22055f0e80c57233
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {avisos, limpiarAvisos} from "./stubs/log";
import {DESPEDIDA_MAX_MS, ESPERA_WORKERS_MS, type IWorkerCierre, cerrarPrimario, instalarCierrePrimario} from "../heartbeat/cierre-primario";

/**
 * El primario de un cluster con el heartbeat habilitado: reenvía la señal, espera (acotado) a los workers y
 * despide el pod antes de salir. Sin esto moría con la señal por defecto y el receptor no veía `parado`.
 */

class WorkerFalso implements IWorkerCierre {
    public readonly senales: NodeJS.Signals[] = [];
    private salido: boolean;
    private readonly callbacks: (() => void)[];

    public constructor(private readonly alRecibir: (w: WorkerFalso) => void = () => undefined, salido = false) {
        this.salido = salido;
        this.callbacks = [];
    }

    public haSalido(): boolean {
        return this.salido;
    }

    public alSalir(cb: () => void): void {
        this.callbacks.push(cb);
    }

    public enviarSenal(senal: NodeJS.Signals): void {
        this.senales.push(senal);
        this.alRecibir(this);
    }

    public salir(): void {
        this.salido = true;
        this.callbacks.forEach((cb) => cb());
    }
}

const montar = (orden: string[]) => ({
    emisor: {
        alIniciarCierre: () => { orden.push("drenando"); },
        despedir: async () => { orden.push("despedir"); },
    },
    salir: (codigo: number) => { orden.push(`salir:${codigo}`); },
});

describe("cerrarPrimario", () => {
    it("marca el cierre, reenvía la señal a cada worker, espera a que salgan, despide y sale con 0", async () => {
        const orden: string[] = [];
        const a = new WorkerFalso((w) => setTimeout(() => { orden.push("worker-a-sale"); w.salir(); }, 20));
        const b = new WorkerFalso((w) => setTimeout(() => { orden.push("worker-b-sale"); w.salir(); }, 40));
        await cerrarPrimario({senal: "SIGTERM", workers: [a, b], ...montar(orden), esperaMs: 2000});
        assert.deepEqual(a.senales, ["SIGTERM"]);
        assert.deepEqual(b.senales, ["SIGTERM"]);
        assert.deepEqual(orden, ["drenando", "worker-a-sale", "worker-b-sale", "despedir", "salir:0"]);
    });

    it("un worker que ya salió no recibe la señal ni se espera", async () => {
        const orden: string[] = [];
        const muerto = new WorkerFalso(() => undefined, true);
        await cerrarPrimario({senal: "SIGINT", workers: [muerto], ...montar(orden), esperaMs: 2000});
        assert.deepEqual(muerto.senales, []);
        assert.deepEqual(orden, ["drenando", "despedir", "salir:0"]);
    });

    it("un worker que no sale vence la espera: se avisa y se despide igualmente, dentro del margen", async () => {
        limpiarAvisos();
        const orden: string[] = [];
        const colgado = new WorkerFalso();
        const t0 = Date.now();
        await cerrarPrimario({senal: "SIGTERM", workers: [colgado], ...montar(orden), esperaMs: 100});
        const espera = Date.now() - t0;
        assert.deepEqual(orden, ["drenando", "despedir", "salir:0"]);
        assert.ok(espera >= 90 && espera < 1000, `esperó ${espera} ms`);
        assert.equal(avisos.length, 1);
    });

    it("sin workers despide y sale; si fallan el emisor o el reenvío, sigue", async () => {
        const orden: string[] = [];
        await cerrarPrimario({senal: "SIGTERM", workers: [], ...montar(orden), esperaMs: 100});
        assert.deepEqual(orden, ["drenando", "despedir", "salir:0"]);

        const orden2: string[] = [];
        const roto = new WorkerFalso(() => { throw new Error("ESRCH"); });
        await cerrarPrimario({
            senal: "SIGTERM",
            workers: [roto],
            emisor: {alIniciarCierre: () => { throw new Error("x"); }, despedir: async () => { throw new Error("y"); }},
            salir: (codigo) => orden2.push(`salir:${codigo}`),
            esperaMs: 100,
        });
        assert.deepEqual(orden2, ["salir:0"]);
    });

    it("una despedida que no termina se corta a despedidaMs: se avisa y se sale con 0 sin esperarla", async () => {
        limpiarAvisos();
        const orden: string[] = [];
        const t0 = Date.now();
        await cerrarPrimario({
            senal: "SIGTERM",
            workers: [],
            emisor: {alIniciarCierre: () => { orden.push("drenando"); }, despedir: async () => new Promise<void>(() => undefined)},
            salir: (codigo) => { orden.push(`salir:${codigo}`); },
            despedidaMs: 80,
        });
        const espera = Date.now() - t0;
        assert.deepEqual(orden, ["drenando", "salir:0"]);
        assert.ok(espera >= 70 && espera < 1000, `esperó ${espera} ms`);
        assert.equal(avisos.length, 1);
    });

    it("sin emisor (heartbeat deshabilitado) reenvía la señal, espera a los workers y sale con 0 sin despedir", async () => {
        const orden: string[] = [];
        const a = new WorkerFalso((w) => setTimeout(() => { orden.push("worker-sale"); w.salir(); }, 20));
        await cerrarPrimario({senal: "SIGTERM", workers: [a], emisor: null, salir: (codigo) => { orden.push(`salir:${codigo}`); }, esperaMs: 2000});
        assert.deepEqual(a.senales, ["SIGTERM"]);
        assert.deepEqual(orden, ["worker-sale", "salir:0"]);
    });

    it("la espera a los workers incluye el margen de endpoints pendiente", async () => {
        limpiarAvisos();
        const orden: string[] = [];
        const colgado = new WorkerFalso();
        const t0 = Date.now();
        await cerrarPrimario({senal: "SIGTERM", workers: [colgado], ...montar(orden), esperaMs: 100, margen: async () => 150});
        const espera = Date.now() - t0;
        assert.ok(espera >= 240 && espera < 1000, `esperó ${espera} ms (margen 150 + espera 100)`);
        assert.equal(avisos.length, 1);
    });

    it("el margen es el que se calcula tras reenviar la señal: un worker lento dentro de margen + espera no vence", async () => {
        limpiarAvisos();
        const orden: string[] = [];
        const lento = new WorkerFalso((w) => setTimeout(() => { w.salir(); }, 200));
        await cerrarPrimario({senal: "SIGTERM", workers: [lento], ...montar(orden), esperaMs: 100, margen: async () => 300});
        assert.equal(avisos.length, 0);
        assert.deepEqual(orden, ["drenando", "despedir", "salir:0"]);
    });

    it("el peor caso (margen + espera a los workers + despedida) cabe en los 25 s de gracia con margen", () => {
        // shutdownTimeout de 18 s + 1 s de antesDeSalir en los workers = 19 s: la espera no puede pasar de ahí.
        assert.ok(ESPERA_WORKERS_MS <= 19_000);
        assert.equal(DESPEDIDA_MAX_MS, 1000);
        // El margen de 3 s desde el lock cuenta dentro de la gracia; 2 s de margen para el `salir`.
        assert.ok(3_000 + ESPERA_WORKERS_MS + DESPEDIDA_MAX_MS <= 25_000 - 2_000);
    });
});

describe("instalarCierrePrimario", () => {
    it("la primera señal cierra los workers; una segunda, de cualquiera de las dos, sale ya con 128 + n", async () => {
        const orden: string[] = [];
        const colgado = new WorkerFalso();
        const quitar = instalarCierrePrimario({
            workers: () => [colgado],
            emisor: null,
            salir: (codigo) => { orden.push(`salir:${codigo}`); },
        });
        try {
            process.emit("SIGTERM", "SIGTERM");
            await new Promise<void>(resolve => setTimeout(resolve, 20));
            assert.deepEqual(colgado.senales, ["SIGTERM"]);
            assert.deepEqual(orden, []);
            process.emit("SIGTERM", "SIGTERM");
            process.emit("SIGINT", "SIGINT");
            assert.deepEqual(orden, ["salir:143", "salir:130"]);
            assert.deepEqual(colgado.senales, ["SIGTERM"]);
        } finally {
            quitar();
        }
        assert.equal(process.listenerCount("SIGTERM") + process.listenerCount("SIGINT"), 0);
    });
});
