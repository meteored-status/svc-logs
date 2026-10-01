/**
 * Editor: Bixus
 * Fecha: Mon, 28 Sep 2026 07:47:02 GMT
 * Hash: 400b81076284c092cdc9b5a20d3cf183
 * Versión: 2026.9.28+2-bixus
 * Proyecto: https://github.com/alpred/meteored-svc-localizacion.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Cache, type ICacheDoc} from "../../../modules/database/mysql/cache";

/**
 * `Cache` en memoria: sin disco, para probar solo la lógica común de `Cache.get()`.
 */
class MemoriaCache<T> extends Cache<T> {
    /* INSTANCE */
    private readonly docs: Record<string, ICacheDoc<T>>;

    public constructor() {
        super("SELECT 1", {cleanup: false});
        this.docs = {};
    }

    protected async fromCache(key: string): Promise<ICacheDoc<T>|undefined> {
        return this.docs[key];
    }

    protected async toCache(key: string, data: ICacheDoc<T>): Promise<void> {
        this.docs[key] = data;
    }

    protected cleanCache(key: string): void {
        delete this.docs[key];
    }
}

describe("Cache.get", () => {

    it("una consulta que falla no deja la clave rota: la siguiente vuelve a consultar", async () => {
        const cache = new MemoriaCache<number>();
        let llamadas = 0;
        const consulta = async (): Promise<number[]> => {
            llamadas++;
            if (llamadas===1) {
                return Promise.reject(new Error("MySQL caído"));
            }
            return [42];
        };

        await assert.rejects(cache.get("SELECT 1", [1], consulta), /MySQL caído/);
        assert.deepEqual(await cache.get("SELECT 1", [1], consulta), [42]);
        assert.equal(llamadas, 2);
    });

    it("las peticiones simultáneas con la misma clave comparten una sola consulta", async () => {
        const cache = new MemoriaCache<number>();
        let llamadas = 0;
        const consulta = async (): Promise<number[]> => {
            llamadas++;
            return [7];
        };

        const [a, b] = await Promise.all([
            cache.get("SELECT 1", [1], consulta),
            cache.get("SELECT 1", [1], consulta),
        ]);
        assert.deepEqual(a, [7]);
        assert.deepEqual(b, [7]);
        assert.equal(llamadas, 1);
    });

});
