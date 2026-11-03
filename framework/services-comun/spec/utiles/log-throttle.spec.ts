/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 02 Nov 2026 11:05:48 GMT
 * Hash: 418ae474f2b2e51b0196179ccc2e10d3
 * Versión: 2026.11.2+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-cmp.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {errorType, LogThrottle} from "../../modules/utiles/log-throttle";

describe("LogThrottle", () => {
    it("deja pasar el primero y calla el resto de ese tipo durante un minuto", () => {
        const throttle = new LogThrottle();
        assert.equal(throttle.allow("e", 1_000), 0);
        assert.equal(throttle.allow("e", 1_001), null);
        assert.equal(throttle.allow("e", 60_999), null);
    });

    it("pasado el minuto vuelve a dejar pasar e informa de cuántos calló", () => {
        const throttle = new LogThrottle();
        throttle.allow("e", 0);
        throttle.allow("e", 10);
        throttle.allow("e", 20);
        assert.equal(throttle.allow("e", 60_000), 2);
        assert.equal(throttle.allow("e", 60_001), null);
        assert.equal(throttle.allow("e", 120_000), 1);
    });

    it("cada tipo tiene su propio minuto", () => {
        const throttle = new LogThrottle();
        assert.equal(throttle.allow("a", 0), 0);
        assert.equal(throttle.allow("b", 1), 0);
        assert.equal(throttle.allow("a", 2), null);
        assert.equal(throttle.allow("b", 3), null);
    });

    it("si el reloj retrocede no se queda callado para siempre", () => {
        const throttle = new LogThrottle();
        throttle.allow("e", 1_000_000);
        assert.equal(throttle.allow("e", 5), 0);
    });

    it("el intervalo se puede configurar", () => {
        const throttle = new LogThrottle(1_000);
        assert.equal(throttle.allow("e", 0), 0);
        assert.equal(throttle.allow("e", 999), null);
        assert.equal(throttle.allow("e", 1_000), 1);
    });
});

describe("errorType", () => {
    it("usa el código del error si lo tiene y, si no, el nombre de su clase", () => {
        const refused = Object.assign(new Error("connect ECONNREFUSED"), {code: "ECONNREFUSED"});
        assert.equal(errorType(refused), "ECONNREFUSED");
        assert.equal(errorType(new TypeError("x")), "TypeError");
        class Propio extends Error {}
        assert.equal(errorType(new Propio("x")), "Propio");
    });

    it("para algo que no es un error, el tipo del valor", () => {
        assert.equal(errorType("texto"), "string");
        assert.equal(errorType(42), "number");
        assert.equal(errorType(undefined), "undefined");
        assert.equal(errorType(null), "object");
    });
});
