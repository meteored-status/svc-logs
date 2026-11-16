/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 77c076d3a8d7241fa7222f5d4134b860
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, readdir, rm, utimes, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {HOLGURA_PRESUPUESTO_MS, MARGEN_ENDPOINTS_MS, NOMBRE_LOCK_APAGADO, borrarLockApagado, calcularMargenPendiente, esperaMargenMs, margenPendienteMs} from "../engine/lock";
import {PRESUPUESTO_ANTES_DE_CERRAR_MS} from "@mr/core-network/server/http/config/net";

/**
 * `shutdown.lock` vive en un `emptyDir`, que sobrevive a un reinicio del contenedor por la liveness: el
 * contenedor nuevo lo encontraría al arrancar y se apagaría solo. Se borra antes de vigilar la carpeta.
 */

const conCarpeta = async (prueba: (dir: string) => Promise<void>): Promise<void> => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "lock-"));
    try {
        await prueba(dir);
    } finally {
        await rm(dir, {recursive: true, force: true});
    }
};

describe("borrarLockApagado", () => {
    it("borra un shutdown.lock que ya existía, y solo ese fichero", async () => {
        await conCarpeta(async (dir) => {
            await writeFile(path.join(dir, NOMBRE_LOCK_APAGADO), "");
            await writeFile(path.join(dir, "otro.txt"), "");
            assert.equal(await borrarLockApagado(dir), true);
            assert.deepEqual(await readdir(dir), ["otro.txt"]);
        });
    });

    it("sin lock no falla", async () => {
        await conCarpeta(async (dir) => {
            assert.equal(await borrarLockApagado(dir), true);
        });
    });

    it("nunca rechaza: si no puede borrar devuelve false", async () => {
        // Un directorio con ese nombre y contenido: `rm` sin `recursive` falla con ERR_FS_EISDIR.
        await conCarpeta(async (dir) => {
            await rm(dir, {recursive: true});
            await writeFile(dir, "no soy una carpeta");
            assert.equal(await borrarLockApagado(dir), false);
            await rm(dir, {force: true});
        });
    });
});

describe("calcularMargenPendiente", () => {
    const margenMs = MARGEN_ENDPOINTS_MS;

    it("sin fecha del lock es el margen completo", () => {
        assert.equal(calcularMargenPendiente({ahoraMs: 10_000, mtimeMs: null, margenMs}), margenMs);
    });

    it("descuenta lo que ya ha pasado desde que se escribió el lock", () => {
        assert.equal(calcularMargenPendiente({ahoraMs: 10_000, mtimeMs: 9_000, margenMs}), 2_000);
        assert.equal(calcularMargenPendiente({ahoraMs: 10_000, mtimeMs: 10_000, margenMs}), margenMs);
    });

    it("un lock más viejo que el margen deja 0, nunca negativo", () => {
        assert.equal(calcularMargenPendiente({ahoraMs: 10_000, mtimeMs: 7_000, margenMs}), 0);
        assert.equal(calcularMargenPendiente({ahoraMs: 10_000, mtimeMs: 1_000, margenMs}), 0);
    });

    it("una fecha en el futuro (reloj distinto) se trata como el margen completo, sin pasarse", () => {
        assert.equal(calcularMargenPendiente({ahoraMs: 10_000, mtimeMs: 50_000, margenMs}), margenMs);
    });
});

describe("margenPendienteMs", () => {
    it("fuera de producción no hay margen aunque no exista el lock", async () => {
        await conCarpeta(async (dir) => {
            assert.equal(await margenPendienteMs({dir, produccion: false}), 0);
        });
    });

    it("en producción sin lock es el margen completo", async () => {
        await conCarpeta(async (dir) => {
            assert.equal(await margenPendienteMs({dir, produccion: true}), MARGEN_ENDPOINTS_MS);
        });
    });

    it("en producción con un lock recién escrito queda casi todo, con uno antiguo 0", async () => {
        await conCarpeta(async (dir) => {
            const lock = path.join(dir, NOMBRE_LOCK_APAGADO);
            await writeFile(lock, "");
            const ahora = Date.now();
            const reciente = await margenPendienteMs({dir, produccion: true, ahora: () => ahora});
            assert.ok(reciente > 2_000 && reciente <= MARGEN_ENDPOINTS_MS, `quedaban ${reciente} ms`);

            const hace = new Date(ahora - 10_000);
            await utimes(lock, hace, hace);
            assert.equal(await margenPendienteMs({dir, produccion: true, ahora: () => ahora}), 0);
        });
    });
});

describe("esperaMargenMs", () => {
    it("sin lock (margen completo) la espera descuenta lo que tardó el stat y queda bajo el presupuesto de antesDeCerrar, para que no venza antes", () => {
        const espera = esperaMargenMs({margenMs: MARGEN_ENDPOINTS_MS, transcurridoMs: 4});
        assert.ok(espera + 4 <= PRESUPUESTO_ANTES_DE_CERRAR_MS - HOLGURA_PRESUPUESTO_MS, `esperaría ${espera} ms`);
        assert.ok(espera > 2_000);
    });

    it("con un margen pendiente pequeño espera ese margen menos lo transcurrido, nunca negativo", () => {
        assert.equal(esperaMargenMs({margenMs: 1_000, transcurridoMs: 100}), 900);
        assert.equal(esperaMargenMs({margenMs: 50, transcurridoMs: 100}), 0);
        assert.equal(esperaMargenMs({margenMs: 0, transcurridoMs: 0}), 0);
    });
});
