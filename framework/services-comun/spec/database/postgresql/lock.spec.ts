/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 17 Nov 2026 09:24:35 GMT
 * Hash: 10a6d7b1f142fc59227c8520e058f227
 * Versión: 2026.11.17+1-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-localizacion.git
 */

import {before, describe, it} from "node:test";
import {join} from "node:path";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import assert from "node:assert/strict";

import type {Pool, PoolClient} from "pg";

import {Lock} from "../../../modules/database/postgresql/lock/lock";
import {PostgreSQL} from "../../../modules/database/postgresql";
import {Transaction} from "../../../modules/database/postgresql/transaction";
import {IsolationLevel} from "../../../modules/database/transaction/isolation";

interface IConsulta {
    sql: string;
    params: unknown[];
}

/**
 * Un cliente de `pg` de mentira: apunta lo que se le pide y responde lo que diga `responder`.
 */
function crearCliente(responder: (sql: string) => unknown): {client: PoolClient; consultas: IConsulta[]; releases: (Error|undefined)[]; oyentes: () => number} {
    const consultas: IConsulta[] = [];
    const releases: (Error|undefined)[] = [];
    const oyentes = new Set<unknown>();
    const client = {
        query: async (sql: string, params: unknown[] = []): Promise<unknown> => {
            consultas.push({sql, params});
            const respuesta = responder(sql);
            if (respuesta instanceof Error) {
                throw respuesta;
            }
            return {rows: [respuesta]};
        },
        on: (_evento: string, oyente: unknown): void => {
            oyentes.add(oyente);
        },
        removeListener: (_evento: string, oyente: unknown): void => {
            oyentes.delete(oyente);
        },
        release: (err?: Error): void => {
            releases.push(err);
        },
    } as unknown as PoolClient;
    return {client, consultas, releases, oyentes: () => oyentes.size};
}

function crearPool(client: PoolClient): {pool: Pool; conexiones: () => number; consultasDelPool: IConsulta[]} {
    let conexiones = 0;
    const consultasDelPool: IConsulta[] = [];
    const pool = {
        connect: async (): Promise<PoolClient> => {
            conexiones++;
            return client;
        },
        query: async (sql: string, params: unknown[] = []): Promise<unknown> => {
            consultasDelPool.push({sql, params});
            return {rows: []};
        },
    } as unknown as Pool;
    return {pool, conexiones: () => conexiones, consultasDelPool};
}

describe("Lock.tryAcquire: bloqueo de sesion no bloqueante en una conexion propia", () => {
    before(() => {
        // Las define el bundler en cada servicio; con tsc + Node hay que fijarlas aqui.
        globalThis.DESARROLLO = false;
        globalThis.PRODUCCION = false;
        globalThis.TEST = false;
    });

    it("si lo consigue, usa pg_try_advisory_lock con hashtext(nombre) y deja la conexion reservada hasta release()", async () => {
        const fake = crearCliente(sql => sql.includes("pg_try_advisory_lock") ? {locked: true} : {unlocked: true});
        const {pool, conexiones, consultasDelPool} = crearPool(fake.client);

        const lock = await Lock.tryAcquire("core.mi_clave", pool);

        assert.ok(lock);
        assert.equal(conexiones(), 1);
        assert.match(fake.consultas[0]!.sql, /pg_try_advisory_lock\(hashtext\(\$1\)\)/);
        assert.deepEqual(fake.consultas[0]!.params, ["core.mi_clave"]);
        assert.equal(fake.releases.length, 0, "la conexion sigue reservada mientras se tiene el bloqueo");
        assert.equal(fake.oyentes(), 1, "la conexion tiene un oyente de error mientras es nuestra");

        await lock.release();

        assert.match(fake.consultas[1]!.sql, /pg_advisory_unlock\(hashtext\(\$1\)\)/);
        assert.deepEqual(fake.consultas[1]!.params, ["core.mi_clave"]);
        assert.deepEqual(fake.releases, [undefined], "se suelta en la MISMA conexion y se devuelve sin error");
        assert.equal(fake.oyentes(), 0);
        assert.equal(consultasDelPool.length, 0, "nada va por pool.query: el unlock iria a otra conexion");
    });

    it("si lo tiene otra sesion, devuelve null y devuelve la conexion al pool", async () => {
        const fake = crearCliente(() => ({locked: false}));
        const {pool} = crearPool(fake.client);

        const lock = await Lock.tryAcquire("core.mi_clave", pool);

        assert.equal(lock, null);
        assert.deepEqual(fake.releases, [undefined]);
        assert.equal(fake.oyentes(), 0);
        assert.equal(fake.consultas.length, 1, "no hay unlock de algo que no se tomo");
    });

    it("si la consulta falla, rechaza y DESTRUYE la conexion (release con el error)", async () => {
        const fallo = new Error("conexion rota");
        const fake = crearCliente(() => fallo);
        const {pool} = crearPool(fake.client);

        await assert.rejects(Lock.tryAcquire("core.mi_clave", pool), /conexion rota/);

        assert.deepEqual(fake.releases, [fallo]);
        assert.equal(fake.oyentes(), 0);
    });

    it("si el unlock falla, release() rechaza y destruye la conexion: el servidor suelta el bloqueo al cerrarla", async () => {
        const fallo = new Error("unlock roto");
        const fake = crearCliente(sql => sql.includes("pg_try_advisory_lock") ? {locked: true} : fallo);
        const {pool} = crearPool(fake.client);
        const lock = await Lock.tryAcquire("core.mi_clave", pool);

        await assert.rejects(lock!.release(), /unlock roto/);

        assert.deepEqual(fake.releases, [fallo]);
    });

    it("release() es idempotente: la segunda vez no toca la conexion que ya se devolvio", async () => {
        const fake = crearCliente(sql => sql.includes("pg_try_advisory_lock") ? {locked: true} : {unlocked: true});
        const {pool, consultasDelPool} = crearPool(fake.client);
        const lock = await Lock.tryAcquire("core.mi_clave", pool);

        await lock!.release();
        await lock!.release();

        assert.equal(fake.releases.length, 1);
        assert.equal(fake.consultas.length, 2);
        assert.equal(consultasDelPool.length, 0);
    });
});

describe("Lock.acquire (el de siempre) no cambia", () => {
    it("toma y suelta con pool.query", async () => {
        const fake = crearCliente(() => ({}));
        const {pool, consultasDelPool, conexiones} = crearPool(fake.client);

        const lock = await Lock.acquire("clave", pool);
        await lock!.release();

        assert.match(consultasDelPool[0]!.sql, /pg_advisory_lock\(hashtext\(\$1\)\)/);
        assert.match(consultasDelPool[1]!.sql, /pg_advisory_unlock\(hashtext\(\$1\)\)/);
        assert.equal(conexiones(), 0);
    });
});

describe("PostgreSQL.tryLock: la conexion directa", () => {
    it("con credenciales en formato cluster SIN notify rechaza con un mensaje claro, sin tocar la primaria", async () => {
        const tmp = mkdtempSync(join(tmpdir(), "pg-lock-"));
        try {
            const credenciales = join(tmp, "postgresql.json");
            writeFileSync(credenciales, JSON.stringify({primary: {host: "127.0.0.1", port: 1}, read: {host: "127.0.0.1", port: 1}, common: {user: "u", password: "p"}}));
            const db = PostgreSQL.build({credenciales, database: "prueba"});

            await assert.rejects(db.tryLock("clave"), /notify/);

            await db[Symbol.asyncDispose]();
        } finally {
            rmSync(tmp, {recursive: true, force: true});
        }
    });
});

describe("Transaction.begin con IsolationLevel", () => {
    function crearTransaccion(): {transaction: Transaction; consultas: IConsulta[]} {
        const fake = crearCliente(() => ({}));
        const {pool} = crearPool(fake.client);
        return {transaction: new Transaction(pool), consultas: fake.consultas};
    }

    it("REPEATABLE_READ abre con BEGIN y fija REPEATABLE READ antes de la primera consulta", async () => {
        const {transaction, consultas} = crearTransaccion();

        await transaction.begin(IsolationLevel.REPEATABLE_READ);

        assert.deepEqual(consultas.map(c => c.sql), ["BEGIN", "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"]);
    });

    it("SERIALIZABLE sigue igual", async () => {
        const {transaction, consultas} = crearTransaccion();

        await transaction.begin(IsolationLevel.SERIALIZABLE);

        assert.deepEqual(consultas.map(c => c.sql), ["BEGIN", "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"]);
    });

    it("sin nivel, solo BEGIN (el del servidor: READ COMMITTED)", async () => {
        const {transaction, consultas} = crearTransaccion();

        await transaction.begin();

        assert.deepEqual(consultas.map(c => c.sql), ["BEGIN"]);
    });
});
