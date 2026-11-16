/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:11 GMT
 * Hash: 744b0a609461931977a9ee134f6fd4b5
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {aplicarSocket, calcularBajas, canonico, esReintentable, hashDocumento, necesitaVersion, normalizarRepositorio} from "../../src/clases/auto-doc/canonico";

describe("canonico y hashDocumento", () => {
    it("ordena las claves de los objetos recursivamente y respeta el orden de los arrays", () => {
        assert.equal(canonico({b: 1, a: {d: [2, 1], c: null}}), `{"a":{"c":null,"d":[2,1]},"b":1}`);
        assert.notEqual(canonico({a: [1, 2]}), canonico({a: [2, 1]}));
    });

    it("ignora las claves undefined, como JSON.stringify", () => {
        assert.equal(canonico({a: 1, b: undefined}), canonico({a: 1}));
    });

    it("mismo hash con las claves reordenadas; distinto si cambia un tipo", () => {
        const a = {paths: {"/x": {get: {schema: {type: "string", format: "date"}}}}, info: {title: "svc"}};
        const reordenado = {info: {title: "svc"}, paths: {"/x": {get: {schema: {format: "date", type: "string"}}}}};
        const distinto = {info: {title: "svc"}, paths: {"/x": {get: {schema: {format: "date", type: "number"}}}}};

        assert.equal(hashDocumento(a), hashDocumento(reordenado));
        assert.notEqual(hashDocumento(a), hashDocumento(distinto));
        assert.match(hashDocumento(a), /^[0-9a-f]{64}$/);
    });
});

describe("necesitaVersion", () => {
    it("crea versión si no hay vigente o si el hash cambia, y no si coincide", () => {
        assert.equal(necesitaVersion(undefined, "h1"), true);
        assert.equal(necesitaVersion(null, "h1"), true);
        assert.equal(necesitaVersion("h0", "h1"), true);
        assert.equal(necesitaVersion("h1", "h1"), false);
    });
});

describe("calcularBajas", () => {
    const vigentes = new Set(["a", "b"]);

    it("da de baja los registrados que ya no están en ningún manifest", () => {
        const salida = calcularBajas({vigentes, registrados: ["a", "b", "c", "d"], completo: true, filtrado: false});
        assert.deepEqual(salida.bajas, ["c", "d"]);
        assert.equal(salida.aviso, undefined);
    });

    it("manifest ilegible: ninguna baja y aviso", () => {
        const salida = calcularBajas({vigentes, registrados: ["a", "c"], completo: false, filtrado: false});
        assert.deepEqual(salida.bajas, []);
        assert.match(salida.aviso!, /no se ha podido leer/);
    });

    it("con --servicio: ninguna baja y aviso", () => {
        const salida = calcularBajas({vigentes, registrados: ["c"], completo: true, filtrado: true});
        assert.deepEqual(salida.bajas, []);
        assert.match(salida.aviso!, /--servicio/);
    });

    it("un servicio que sigue en los manifests no se da de baja aunque no se haya generado", () => {
        const salida = calcularBajas({vigentes: new Set(["a", "falla"]), registrados: ["falla"], completo: true, filtrado: false});
        assert.deepEqual(salida.bajas, []);
    });
});

describe("normalizarRepositorio", () => {
    it("acepta URL, scp y propietario/nombre, y quita credenciales y .git", () => {
        assert.equal(normalizarRepositorio("https://github.com/meteored-status/svc-panel.git"), "meteored-status/svc-panel");
        assert.equal(normalizarRepositorio("https://user:secreto@github.com/meteored-status/svc-panel"), "meteored-status/svc-panel");
        assert.equal(normalizarRepositorio("git@github.com:meteored-status/svc-panel.git\n"), "meteored-status/svc-panel");
        assert.equal(normalizarRepositorio("ssh://git@github.com/meteored-status/svc-panel.git"), "meteored-status/svc-panel");
        assert.equal(normalizarRepositorio("meteored-status/svc-panel"), "meteored-status/svc-panel");
    });

    it("rechaza lo que no tiene forma propietario/nombre", () => {
        assert.equal(normalizarRepositorio(""), undefined);
        assert.equal(normalizarRepositorio("solonombre"), undefined);
        assert.equal(normalizarRepositorio("https://github.com/a/b/c"), undefined);
    });
});

describe("aplicarSocket", () => {
    it("cambia master, slaves y socketPath plano sin tocar el original", () => {
        const original = {master: {host: "h", socketPath: "/x"}, slaves: [{host: "h"}, {host: "h2"}], common: {user: "u"}};
        const salida = aplicarSocket(original, "/root/s") as typeof original;
        assert.equal(salida.master.socketPath, "/root/s");
        assert.deepEqual(salida.slaves.map(s => (s as {socketPath?: string}).socketPath), ["/root/s", "/root/s"]);
        assert.equal(original.master.socketPath, "/x");

        assert.equal((aplicarSocket({host: "h", socketPath: "/x"}, "/root/s") as {socketPath: string}).socketPath, "/root/s");
        assert.equal((aplicarSocket({host: "h"}, "/root/s") as {socketPath: string}).socketPath, "/root/s");
        const sinSlaves = aplicarSocket({master: {host: "h"}}, "/root/s") as {slaves: {socketPath: string}[]};
        assert.equal(sinSlaves.slaves[0].socketPath, "/root/s");
    });
});

describe("esReintentable", () => {
    it("solo las carreras de MySQL: clave duplicada e interbloqueo", () => {
        assert.equal(esReintentable(Object.assign(new Error("x"), {code: "ER_DUP_ENTRY"})), true);
        assert.equal(esReintentable(Object.assign(new Error("x"), {code: "ER_LOCK_DEADLOCK"})), true);
        assert.equal(esReintentable(Object.assign(new Error("x"), {code: "ER_ACCESS_DENIED_ERROR"})), false);
        assert.equal(esReintentable(new Error("x")), false);
        assert.equal(esReintentable(null), false);
        assert.equal(esReintentable("ER_DUP_ENTRY"), false);
    });
});
