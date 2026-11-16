/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 11:00:00 GMT
 * Hash: 95fc0e890a268a5c54bf7d872ba9b5aa
 * Versión: 2026.11.16+2-bixus
 * Anterior: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./helpers";

import {afterEach, describe, it} from "node:test";
import assert from "node:assert/strict";

import {acotarShutdownTimeout, avisoShutdownTimeout, type INet, Net} from "../server/http/config/net";

/**
 * `shutdownTimeout` acotado para que el cierre quepa en la gracia del pod: en producción, un valor mayor
 * que 18 s o menor o igual que 0 se recorta a 18 s; los menores se respetan. En desarrollo no se toca. El recorte no avisa al
 * construir `Net` (el módulo lo carga también el navegador): `avisoShutdownTimeout()` da el texto, y lo emite el servidor al arrancar.
 */

const original = global.PRODUCCION;

const defecto = (shutdownTimeout: number): INet => ({
    puertos: {http: 1, https: 2},
    endpoints: {http: [], https: []},
    compress: false,
    cacheTags: [],
    uploadDir: "files/tmp",
    maxFileSize: 1,
    slow: 1,
    maxRequestBodySize: 1,
    trustProxy: false,
    keepAliveTimeout: 1,
    headersTimeout: 1,
    shutdownTimeout,
});

describe("shutdownTimeout acotado", () => {
    afterEach(() => {
        global.PRODUCCION = original;
    });

    it("producción: 25 000 se recorta a 18 000 con aviso", () => {
        global.PRODUCCION = true;
        const net = new Net(defecto(18_000), {shutdownTimeout: 25_000});
        assert.equal(net.shutdownTimeout, 18_000);
        assert.equal(net.shutdownTimeoutPedido, 25_000);
        assert.equal(avisoShutdownTimeout(net), "shutdownTimeout de 25000 ms fuera de lo que cabe en la gracia del pod: se recorta a 18000 ms");
    });

    it("producción: 0 (sin corte) se recorta a 18 000", () => {
        global.PRODUCCION = true;
        const net = new Net(defecto(18_000), {shutdownTimeout: 0});
        assert.equal(net.shutdownTimeout, 18_000);
        assert.notEqual(avisoShutdownTimeout(net), null);
    });

    it("producción: un valor negativo se recorta a 18 000", () => {
        global.PRODUCCION = true;
        assert.equal(acotarShutdownTimeout(-1, {produccion: true}), 18_000);
    });

    it("producción: 10 000 y 18 000 se respetan, sin aviso", () => {
        global.PRODUCCION = true;
        const diez = new Net(defecto(18_000), {shutdownTimeout: 10_000});
        const porDefecto = new Net(defecto(18_000), {});
        assert.equal(diez.shutdownTimeout, 10_000);
        assert.equal(porDefecto.shutdownTimeout, 18_000);
        assert.equal(avisoShutdownTimeout(diez), null);
        assert.equal(avisoShutdownTimeout(porDefecto), null);
    });

    it("producción: también se acota el valor por defecto que llega de buildDefault", () => {
        global.PRODUCCION = true;
        const net = new Net(defecto(30_000), {});
        assert.equal(net.shutdownTimeout, 18_000);
        assert.equal(net.shutdownTimeoutPedido, 30_000);
        assert.notEqual(avisoShutdownTimeout(net), null);
    });

    it("desarrollo: no se toca", () => {
        global.PRODUCCION = false;
        const largo = new Net(defecto(2_000), {shutdownTimeout: 25_000});
        const cero = new Net(defecto(2_000), {shutdownTimeout: 0});
        assert.equal(largo.shutdownTimeout, 25_000);
        assert.equal(cero.shutdownTimeout, 0);
        assert.equal(avisoShutdownTimeout(largo), null);
        assert.equal(avisoShutdownTimeout(cero), null);
    });

    it("config/net.ts no importa nada de services-comun (lo carga también el navegador)", async () => {
        // El script `test` corre en la raíz del workspace. Se lee el fuente y no el compilado: un `import type` desaparece al
        // compilar y no molesta, pero este control lo trata igual, que es lo prudente en un módulo que viaja al navegador.
        const {readFile} = await import("node:fs/promises");
        const {join} = await import("node:path");
        const fuente = await readFile(join(process.cwd(), "server/http/config/net.ts"), "utf8");
        assert.doesNotMatch(fuente, /from\s+"services-comun\//);
    });
});
