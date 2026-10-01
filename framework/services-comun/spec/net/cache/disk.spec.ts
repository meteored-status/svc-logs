/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 01 Oct 2026 08:20:48 GMT
 * Hash: 552e744b76d8a33478d1dbd9d17c1319
 * Versión: 2026.10.1+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-frontend.git
 */

import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach, beforeEach, describe, it} from "node:test";
import assert from "node:assert/strict";

import type {RequestCacheDisk as TRequestCacheDisk} from "../../../modules/net/cache/disk";
import {md5} from "../../../modules/utiles/hash";

/**
 * `disk.ts` importa `TDevice` de `@mr/core-network`, cuyo `exports` apunta a fuentes `.ts` que solo
 * entiende el bundler: compilado con `tsc` y ejecutado con Node, ese import no resuelve. `TDevice`
 * lo usa `NetCacheDisk`, no `RequestCacheDisk`, así que se sustituye por un doble al cargar el módulo.
 */
function cargarRequestCacheDisk(): typeof TRequestCacheDisk {
    const Module = require("node:module") as {_load: (request: string, ...rest: unknown[]) => unknown};
    const load = Module._load;
    Module._load = function (request: string, ...rest: unknown[]): unknown {
        if (request==="@mr/core-network/server/http/config/device") {
            return {TDevice: {}};
        }
        return load.call(this, request, ...rest);
    };
    try {
        return (require("../../../modules/net/cache/disk") as {RequestCacheDisk: typeof TRequestCacheDisk}).RequestCacheDisk;
    } finally {
        Module._load = load;
    }
}

const RequestCacheDisk = cargarRequestCacheDisk();

const URL_PRUEBA = "https://ejemplo.test/recurso";
const CONTENIDO = Buffer.from("contenido de prueba");

describe("RequestCacheDisk", () => {
    let cwd: string;
    let tmp: string;
    let dir: string;
    let cache: TRequestCacheDisk;

    // Escribe los ficheros que leería `check()` sin pasar por `save()`
    function escribir(metadata: object): void {
        const hash = md5(URL_PRUEBA);
        const base = join(dir, hash.substring(0, 2));
        mkdirSync(base, {recursive: true});
        writeFileSync(join(base, `${hash}.json`), JSON.stringify(metadata));
        writeFileSync(join(base, `${hash}.data`), CONTENIDO);
    }

    beforeEach(() => {
        cwd = process.cwd();
        tmp = mkdtempSync(join(tmpdir(), "requestcache-"));
        // save() ignora `path` y escribe en `files/tmp/requestcache` relativo al cwd
        process.chdir(tmp);
        dir = join(tmp, "files/tmp/requestcache");
        cache = new RequestCacheDisk(dir);
    });

    afterEach(() => {
        process.chdir(cwd);
        rmSync(tmp, {recursive: true, force: true});
    });

    describe("check()", () => {
        it("rechaza un fichero legacy con `expires` en string ISO ya pasado", async () => {
            escribir({version: 1, expires: new Date(Date.now() - 60_000).toISOString(), headers: {}});

            await assert.rejects(cache.check(URL_PRUEBA), /Caché expirada/);
        });

        it("rechaza un `expires` numérico ya pasado", async () => {
            escribir({version: 1, expires: Date.now() - 60_000, headers: {}});

            await assert.rejects(cache.check(URL_PRUEBA), /Caché expirada/);
        });

        it("devuelve los datos con un `expires` numérico futuro", async () => {
            const expires = Date.now() + 60_000;
            escribir({version: 1, expires, headers: {}});

            const resp = await cache.check(URL_PRUEBA);

            assert.deepEqual(resp.data, CONTENIDO);
            assert.equal(resp.expires?.getTime(), expires);
        });

        it("devuelve los datos con un `expires` en string ISO futuro", async () => {
            const expires = Date.now() + 60_000;
            escribir({version: 1, expires: new Date(expires).toISOString(), headers: {}});

            const resp = await cache.check(URL_PRUEBA);

            assert.deepEqual(resp.data, CONTENIDO);
            assert.equal(resp.expires?.getTime(), expires);
        });

        it("rechaza un `expires` ilegible en vez de tratarlo como que nunca caduca", async () => {
            escribir({version: 1, expires: "no es una fecha", headers: {}});

            await assert.rejects(cache.check(URL_PRUEBA), /Caché inválida/);
        });
    });

    describe("save()", () => {
        it("escribe `expires` como número", async () => {
            const expires = new Date(Date.now() + 60_000);

            await cache.save(URL_PRUEBA, {data: CONTENIDO, headers: new Headers(), expires});

            const hash = md5(URL_PRUEBA);
            const metadata = JSON.parse(readFileSync(join(dir, hash.substring(0, 2), `${hash}.json`), "utf-8"));
            assert.equal(typeof metadata.expires, "number");
            assert.equal(metadata.expires, expires.getTime());
        });

        it("lo guardado se puede leer con check() hasta que caduca", async () => {
            const expires = new Date(Date.now() + 60_000);

            await cache.save(URL_PRUEBA, {data: CONTENIDO, headers: new Headers(), expires});

            const resp = await cache.check(URL_PRUEBA);
            assert.deepEqual(resp.data, CONTENIDO);
            assert.equal(resp.expires?.getTime(), expires.getTime());
        });
    });
});
