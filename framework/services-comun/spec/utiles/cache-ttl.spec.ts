/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 20 Oct 2026 13:12:58 GMT
 * Hash: 28ab270ffd1f6e044eb564a40ae0b275
 * Versión: 2026.10.20+4-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-api.git
 */

import {describe, it} from "node:test";
import {setTimeout as esperar} from "node:timers/promises";
import assert from "node:assert/strict";

import {CacheTtl} from "../../modules/utiles/cache-ttl";

describe("CacheTtl", () => {

    it("varias peticiones a la vez lanzan una sola carga", async () => {
        let cargas = 0;
        const cache = new CacheTtl<string, number>(1000, async () => { cargas++; await esperar(10); return 7; });

        const valores = await Promise.all([cache.get("a"), cache.get("a"), cache.get("a")]);

        assert.deepEqual(valores, [7, 7, 7]);
        assert.equal(cargas, 1);
    });

    it("la carga recibe la clave", async () => {
        const cache = new CacheTtl<number, string>(1000, async clave => `v${clave}`);

        assert.equal(await cache.get(1), "v1");
        assert.equal(await cache.get(2), "v2");
    });

    it("sirve de caché hasta que caduca y entonces recarga", async () => {
        let ahora = 0;
        let cargas = 0;
        const cache = new CacheTtl<string, number>(100, async () => ++cargas, {ahora: () => ahora});

        assert.equal(await cache.get("a"), 1);
        ahora = 99;
        assert.equal(await cache.get("a"), 1);
        ahora = 100;
        assert.equal(await cache.get("a"), 2);
    });

    it("cada clave tiene su entrada", async () => {
        const cache = new CacheTtl<string, string>(1000, async clave => clave.toUpperCase());

        assert.equal(await cache.get("a"), "A");
        assert.equal(await cache.get("b"), "B");
        assert.equal(await cache.get("a"), "A");
    });

    it("un fallo no se cachea: rechaza a todos los que esperaban y la siguiente petición reintenta", async () => {
        let cargas = 0;
        let fallar = true;
        const cache = new CacheTtl<string, number>(1000, async () => {
            cargas++;
            await esperar(5);
            if (fallar) {
                throw new Error("fallo");
            }
            return 5;
        });

        const resultados = await Promise.allSettled([cache.get("a"), cache.get("a")]);

        assert.deepEqual(resultados.map(r => r.status), ["rejected", "rejected"]);
        assert.equal(cargas, 1);

        fallar = false;
        assert.equal(await cache.get("a"), 5);
        assert.equal(cargas, 2);
    });

    it("una carga que lanza de forma síncrona rechaza y no deja la clave enganchada", async () => {
        let cargas = 0;
        const cache = new CacheTtl<string, number>(1000, (): Promise<number> => {
            cargas++;
            if (cargas === 1) {
                throw new Error("síncrono");
            }
            return Promise.resolve(9);
        });

        await assert.rejects(cache.get("a"), /síncrono/);
        assert.equal(await cache.get("a"), 9);
        assert.equal(cargas, 2);
    });

    it("las entradas caducadas se barren cuando termina otra carga", async () => {
        let ahora = 0;
        const cache = new CacheTtl<string, number>(100, async () => 1, {ahora: () => ahora});
        // El mapa es privado: es la única forma de comprobar que no se acumulan claves que ya nadie pide
        const entradas = (cache as unknown as {entradas: Map<string, unknown>}).entradas;

        await cache.get("a");
        await cache.get("b");
        assert.equal(entradas.size, 2);

        ahora = 500;
        await cache.get("c");

        assert.deepEqual([...entradas.keys()], ["c"]);
    });

    describe("delete", () => {

        it("invalida la entrada: la siguiente petición recarga", async () => {
            let cargas = 0;
            const cache = new CacheTtl<string, number>(1000, async () => ++cargas);

            assert.equal(await cache.get("a"), 1);
            cache.delete("a");

            assert.equal(await cache.get("a"), 2);
        });

        it("solo invalida esa clave", async () => {
            let cargas = 0;
            const cache = new CacheTtl<string, number>(1000, async () => ++cargas);

            await cache.get("a");
            await cache.get("b");
            cache.delete("a");

            assert.equal(await cache.get("b"), 2);
            assert.equal(await cache.get("a"), 3);
            assert.equal(cargas, 3);
        });

        it("borrar una clave que no está no hace nada", async () => {
            const cache = new CacheTtl<string, number>(1000, async () => 1);

            assert.doesNotThrow(() => cache.delete("nada"));
            assert.equal(await cache.get("a"), 1);
        });

        it("con una carga en curso: la deja terminar, pero no guarda su resultado", async () => {
            let cargas = 0;
            const cache = new CacheTtl<string, number>(1000, async () => {
                const mia = ++cargas;
                await esperar(20);
                return mia;
            });

            const enCurso = cache.get("a");
            cache.delete("a");

            // Quien ya la esperaba recibe su resultado...
            assert.equal(await enCurso, 1);
            // ...pero no se guardó: la siguiente petición lanza una carga nueva
            assert.equal(await cache.get("a"), 2);
            assert.equal(cargas, 2);
        });

        it("con una carga en curso: una petición posterior no se une a la invalidada", async () => {
            let cargas = 0;
            const cache = new CacheTtl<string, number>(1000, async () => {
                const mia = ++cargas;
                await esperar(mia === 1 ? 40 : 5);
                return mia;
            });

            const vieja = cache.get("a");
            cache.delete("a");
            const nueva = cache.get("a");

            assert.equal(await nueva, 2);
            assert.equal(await vieja, 1);
            // Lo que queda guardado es la carga nueva, aunque la vieja terminara después
            assert.equal(await cache.get("a"), 2);
            assert.equal(cargas, 2);
        });
    });

    describe("clear", () => {

        it("invalida todas las entradas", async () => {
            let cargas = 0;
            const cache = new CacheTtl<string, number>(1000, async () => ++cargas);

            await cache.get("a");
            await cache.get("b");
            cache.clear();

            assert.equal(await cache.get("a"), 3);
            assert.equal(await cache.get("b"), 4);
        });

        it("con cargas en curso: las deja terminar sin guardarlas", async () => {
            let cargas = 0;
            const cache = new CacheTtl<string, number>(1000, async () => {
                const mia = ++cargas;
                await esperar(20);
                return mia;
            });

            const a = cache.get("a");
            const b = cache.get("b");
            cache.clear();

            assert.deepEqual(await Promise.all([a, b]), [1, 2]);
            assert.equal(await cache.get("a"), 3);
            assert.equal(await cache.get("b"), 4);
        });

        it("sobre una caché vacía no hace nada", () => {
            const cache = new CacheTtl<string, number>(1000, async () => 1);

            assert.doesNotThrow(() => cache.clear());
        });
    });
});
