/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: cb8f70f7aa31cbbce47e79b1268169d6
 * Versión: 2026.11.20+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import type {IResultadoDespedida} from "../heartbeat/emisor";
import {esperarPrimerEnvio, resultadoDeError, terminarEjecucionFinita} from "../heartbeat/finita";

/**
 * El final de una carga finita: despedida del heartbeat, después el sidecar de Istio (la despedida va por la red, que sin él no sale)
 * y por último la salida, siempre con 0.
 */

class ErrorDeNegocio extends Error {
    public constructor() {
        super("clave de acceso de la tabla usuarios");
        this.name = "ErrorDeNegocio";
    }
}

/**
 * Lo que hace `Main` con una ejecución: `ejecutar()` resuelve (ok) o rechaza (error con su nombre), y en los dos casos acaba en
 * `terminarEjecucionFinita`.
 */
async function correr(ejecutar: () => Promise<void>, orden: string[], emisor: boolean = true): Promise<void> {
    let ejecucion: IResultadoDespedida = {resultado: "ok", error: null};
    try {
        await ejecutar();
    } catch (err) {
        ejecucion = resultadoDeError(err);
    }
    await terminarEjecucionFinita({
        emisor: emisor ? {despedir: async (e) => { await new Promise<void>((r) => setTimeout(r, 15)); orden.push(`despedir:${e.resultado}:${e.error}`); }} : null,
        ejecucion,
        stopSidecar: async () => { await new Promise<void>((r) => setTimeout(r, 5)); orden.push("sidecar"); },
        salir: (codigo) => { orden.push(`salir:${codigo}`); },
    });
}

describe("terminarEjecucionFinita", () => {
    it("ejecutar() que resuelve: despedida ok, después el sidecar, después salir con 0", async () => {
        const orden: string[] = [];
        await correr(async () => undefined, orden);
        assert.deepEqual(orden, ["despedir:ok:null", "sidecar", "salir:0"]);
    });

    it("ejecutar() que rechaza: despedida error con el nombre del error, después el sidecar, después salir con 0 (el Job no consta como fallido)", async () => {
        const orden: string[] = [];
        await correr(async () => { throw new ErrorDeNegocio(); }, orden);
        assert.deepEqual(orden, ["despedir:error:ErrorDeNegocio", "sidecar", "salir:0"]);
    });

    it("sin heartbeat: sidecar y salida, como siempre", async () => {
        const orden: string[] = [];
        await correr(async () => undefined, orden, false);
        assert.deepEqual(orden, ["sidecar", "salir:0"]);
    });

    it("si la despedida o el sidecar fallan, se sale igualmente", async () => {
        const orden: string[] = [];
        await terminarEjecucionFinita({
            emisor: {despedir: async () => { throw new Error("x"); }},
            ejecucion: {resultado: "ok", error: null},
            stopSidecar: async () => { throw new Error("y"); },
            salir: (codigo) => { orden.push(`salir:${codigo}`); },
        }).catch(() => undefined);
        assert.deepEqual(orden, ["salir:0"]);
    });
});

describe("resultadoDeError", () => {
    it("lleva solo el nombre del error, nunca el mensaje", () => {
        const r = resultadoDeError(new ErrorDeNegocio());
        assert.deepEqual(r, {resultado: "error", error: "ErrorDeNegocio"});
        assert.equal(JSON.stringify(r).includes("clave"), false);
    });

    it("lo que no es un Error se nombra por su tipo; sin nombre, Error", () => {
        assert.equal(resultadoDeError("texto con datos").error, "string");
        assert.equal(resultadoDeError(undefined).error, "undefined");
        assert.equal(resultadoDeError({code: 1}).error, "object");
        const sinNombre = new Error("x");
        sinNombre.name = "";
        assert.equal(resultadoDeError(sinNombre).error, "Error");
    });
});

describe("esperarPrimerEnvio", () => {
    it("sin emisor (heartbeat desactivado o worker) no hace nada", async () => {
        await esperarPrimerEnvio(null, 1000);
    });

    it("pasa el tope al emisor y espera a que resuelva", async () => {
        const topes: number[] = [];
        await esperarPrimerEnvio({esperarPrimerEnvio: async (ms) => { topes.push(ms); await new Promise<void>((r) => setTimeout(r, 10)); }}, 1000);
        assert.deepEqual(topes, [1000]);
    });

    it("si el emisor falla no rechaza: quien llama sale igualmente", async () => {
        await esperarPrimerEnvio({esperarPrimerEnvio: async () => { throw new Error("x"); }}, 1000);
    });
});
