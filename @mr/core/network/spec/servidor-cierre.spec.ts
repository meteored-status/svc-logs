/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 662deb008ec5742d89f93287309be260
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./helpers";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {avisos, limpiarAvisos} from "./stubs/log";
import type {Net} from "../server/http/config/net";
import {Server} from "../server/http/server";

/**
 * Hooks del cierre por señal del servidor HTTP: el orden (`alIniciarCierre` → `antesDeCerrar` → `close()` ∥
 * `duranteCierre` → `antesDeSalir` → salida), el presupuesto de `antesDeSalir` y `antesDeCerrar`, y el
 * plazo de `duranteCierre`. La salida es inyectable, así que no se llama a `process.exit`.
 */

const config = {shutdownTimeout: 100} as Net;

const preparar = (): {servidor: Server; orden: string[]; salir: (codigo: number) => void} => {
    const servidor = new Server();
    const orden: string[] = [];
    servidor.close = async (): Promise<void> => {
        orden.push("close");
    };

    return {servidor, orden, salir: (codigo) => orden.push(`salir:${codigo}`)};
};

describe("Server.cerrarYSalir()", () => {
    it("sin hooks registrados solo cierra y sale con 0", async () => {
        const {servidor, orden, salir} = preparar();
        await servidor.cerrarYSalir(config, {salir});
        assert.deepEqual(orden, ["close", "salir:0"]);
    });

    it("ejecuta alIniciarCierre antes de close, y antesDeSalir después y antes de salir", async () => {
        const {servidor, orden, salir} = preparar();
        servidor.alIniciarCierre(() => orden.push("inicio"));
        servidor.antesDeSalir(async () => {
            await new Promise<void>(resolve => setTimeout(resolve, 20));
            orden.push("antes");
        });
        await servidor.cerrarYSalir(config, {salir});
        assert.deepEqual(orden, ["inicio", "close", "antes", "salir:0"]);
    });

    it("un antesDeSalir que no termina no retiene la salida más del presupuesto de 1 s", async () => {
        const {servidor, orden, salir} = preparar();
        limpiarAvisos();
        servidor.antesDeSalir(async () => {
            await new Promise<void>(() => undefined);
        });
        const t0 = Date.now();
        await servidor.cerrarYSalir(config, {salir});
        const espera = Date.now() - t0;
        assert.deepEqual(orden, ["close", "salir:0"]);
        assert.ok(espera >= 950 && espera < 1500, `esperó ${espera} ms`);
        assert.equal(avisos.length, 1);
    });

    it("los errores de los callbacks se tragan con warning y no impiden cerrar ni salir", async () => {
        const {servidor, orden, salir} = preparar();
        limpiarAvisos();
        servidor.alIniciarCierre(() => {
            throw new Error("inicio");
        });
        servidor.antesDeSalir(async () => {
            throw new Error("antes");
        });
        servidor.antesDeSalir(async () => {
            orden.push("otro");
        });
        await servidor.cerrarYSalir(config, {salir});
        assert.deepEqual(orden, ["close", "otro", "salir:0"]);
        assert.equal(avisos.length, 2);
    });

    it("isShuttingDown() ya es true dentro de antesDeCerrar y de alIniciarCierre, y antes de close", async () => {
        const {servidor, orden, salir} = preparar();
        servidor.alIniciarCierre(() => orden.push(`inicio:${servidor.isShuttingDown()}`));
        servidor.antesDeCerrar(async () => {
            orden.push(`antesDeCerrar:${servidor.isShuttingDown()}`);
        });
        assert.equal(servidor.isShuttingDown(), false);
        await servidor.cerrarYSalir(config, {salir});
        assert.deepEqual(orden, ["inicio:true", "antesDeCerrar:true", "close", "salir:0"]);
    });

    it("orden completo: alIniciarCierre, antesDeCerrar, close en paralelo con duranteCierre, antesDeSalir y salida", async () => {
        const servidor = new Server();
        const orden: string[] = [];
        servidor.close = async (): Promise<void> => {
            orden.push("close:inicio");
            await new Promise<void>(resolve => setTimeout(resolve, 20));
            orden.push("close:fin");
        };
        servidor.alIniciarCierre(() => orden.push("inicio"));
        servidor.antesDeCerrar(async () => {
            await new Promise<void>(resolve => setTimeout(resolve, 20));
            orden.push("antesDeCerrar");
        });
        servidor.duranteCierre(async () => {
            orden.push("durante:inicio");
            await new Promise<void>(resolve => setTimeout(resolve, 60));
            orden.push("durante:fin");
        });
        servidor.antesDeSalir(async () => {
            orden.push("antesDeSalir");
        });
        await servidor.cerrarYSalir(config, {salir: (codigo) => orden.push(`salir:${codigo}`)});
        assert.deepEqual(orden, ["inicio", "antesDeCerrar", "close:inicio", "durante:inicio", "close:fin", "durante:fin", "antesDeSalir", "salir:0"]);
    });

    it("un antesDeCerrar que no termina se corta con el presupuesto inyectado y no impide cerrar", async () => {
        const {servidor, orden, salir} = preparar();
        limpiarAvisos();
        servidor.antesDeCerrar(async () => {
            await new Promise<void>(() => undefined);
        });
        const t0 = Date.now();
        await servidor.cerrarYSalir(config, {salir, presupuestoAntesDeCerrarMs: 50});
        const espera = Date.now() - t0;
        assert.deepEqual(orden, ["close", "salir:0"]);
        assert.ok(espera >= 40 && espera < 500, `esperó ${espera} ms`);
        assert.equal(avisos.length, 1);
    });

    it("duranteCierre retiene la salida hasta que termina", async () => {
        const {servidor, orden, salir} = preparar();
        servidor.duranteCierre(async () => {
            await new Promise<void>(resolve => setTimeout(resolve, 80));
            orden.push("durante");
        });
        await servidor.cerrarYSalir(config, {salir});
        assert.deepEqual(orden, ["close", "durante", "salir:0"]);
    });

    it("un duranteCierre colgado se acota al shutdownTimeout con un aviso", async () => {
        const {servidor, orden, salir} = preparar();
        limpiarAvisos();
        servidor.duranteCierre(async () => {
            await new Promise<void>(() => undefined);
        });
        const t0 = Date.now();
        await servidor.cerrarYSalir(config, {salir});
        const espera = Date.now() - t0;
        assert.deepEqual(orden, ["close", "salir:0"]);
        assert.ok(espera >= 90 && espera < 600, `esperó ${espera} ms`);
        assert.equal(avisos.length, 1);
        assert.match(avisos[0]!, /duranteCierre/);
    });
});
