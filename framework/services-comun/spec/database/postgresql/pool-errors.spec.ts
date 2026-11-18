/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 17 Nov 2026 09:24:35 GMT
 * Hash: c589e672d7c5c32905f6b50b69978d34
 * Versión: 2026.11.17+1-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-localizacion.git
 */

import {before, describe, it} from "node:test";
import {join} from "node:path";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import assert from "node:assert/strict";

import type {Pool} from "pg";

import {PostgreSQL} from "../../../modules/database/postgresql";

/**
 * Los pools de `PostgreSQL` por dentro (getters privados): solo para comprobar que llevan escuchador de `error`.
 */
interface IPoolsInternos {
    primary: Promise<Pool>;
    replica: Promise<Pool>;
}

describe("PostgreSQL: un error en una conexion inactiva del pool no tumba el proceso", () => {
    before(() => {
        // Las define el bundler en cada servicio; con tsc + Node hay que fijarlas aqui.
        globalThis.DESARROLLO = false;
        globalThis.PRODUCCION = false;
        globalThis.TEST = false;
    });

    it("los pools primary y read escuchan 'error', y emitirlo no lanza (sin escuchador, Node lo lanzaria)", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "pg-pool-errors-"));
        try {
            const credenciales = join(tmp, "postgresql.json");
            writeFileSync(credenciales, JSON.stringify({primary: {host: "127.0.0.1", port: 1}, read: {host: "127.0.0.2", port: 1}, common: {user: "u", password: "p"}}));
            const db = PostgreSQL.build({credenciales, database: "prueba"});
            const internos = db as unknown as IPoolsInternos;

            for (const pool of [await internos.primary, await internos.replica]) {
                assert.ok(pool.listenerCount("error") >= 1);
                for (let i = 0; i < 3; i++) {
                    assert.doesNotThrow(() => pool.emit("error", new Error("terminating connection due to administrator command"), {}));
                }
            }

            await db[Symbol.asyncDispose]();
        } finally {
            rmSync(tmp, {recursive: true, force: true});
        }
    });
});
