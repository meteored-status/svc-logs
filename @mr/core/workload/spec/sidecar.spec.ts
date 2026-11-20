/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: 50325df24fd13cfb7be3b4bf4355e419
 * Versión: 2026.11.20+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {after, before, describe, it} from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type {AddressInfo} from "node:net";

import {pararSidecar} from "../engine/sidecar";

/**
 * La parada del sidecar de Istio al final de un cronjob o job: si no vuelve, el proceso no llega a salir y el pod se queda colgado.
 */

describe("pararSidecar", () => {
    let peticiones: string[];
    let contesta: boolean;
    let servidor: http.Server;
    let puerto: number;

    before(async () => {
        peticiones = [];
        contesta = true;
        servidor = http.createServer((req, res) => {
            peticiones.push(`${req.method} ${req.url}`);
            if (contesta) {
                res.end("ok");
            }
        });
        await new Promise<void>((resolve) => { servidor.listen(0, "localhost", resolve); });
        puerto = (servidor.address() as AddressInfo).port;
    });

    after(async () => {
        servidor.closeAllConnections();
        await new Promise<void>((resolve) => { servidor.close(() => { resolve(); }); });
    });

    it("manda POST /quitquitquit y vuelve con la respuesta", async () => {
        contesta = true;
        peticiones.length = 0;
        const inicio = Date.now();
        await pararSidecar({puerto, maxMs: 5000});
        assert.deepEqual(peticiones, ["POST /quitquitquit"]);
        assert.ok(Date.now() - inicio < 1000);
    });

    it("si el proxy acepta la conexión y no contesta, vuelve al agotar el tope", async () => {
        contesta = false;
        peticiones.length = 0;
        const inicio = Date.now();
        await pararSidecar({puerto, maxMs: 200});
        const tardado = Date.now() - inicio;
        assert.deepEqual(peticiones, ["POST /quitquitquit"]);
        assert.ok(tardado >= 180 && tardado < 1500, `tardó ${tardado} ms`);
    });

    it("sin sidecar (conexión rechazada) vuelve sin rechazar", async () => {
        const libre = http.createServer();
        await new Promise<void>((resolve) => { libre.listen(0, "localhost", resolve); });
        const cerrado = (libre.address() as AddressInfo).port;
        await new Promise<void>((resolve) => { libre.close(() => { resolve(); }); });
        await pararSidecar({puerto: cerrado, maxMs: 5000});
    });
});
