/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 17 Nov 2026 09:24:35 GMT
 * Hash: 4283d35fc8fb608f8324ebd939a8d007
 * Versión: 2026.11.17+1-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-localizacion.git
 */

import type {AddressInfo} from "node:net";
import {after, before, describe, it} from "node:test";
import {createServer, type Server} from "node:http";
import {join} from "node:path";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import assert from "node:assert/strict";

import {Deferred} from "../../modules/utiles/promise";
import {Elasticsearch} from "../../modules/elasticsearch";

type TModo = "503" | "cuelga";

/**
 * Servidor que se hace pasar por un Elasticsearch roto y cuenta las peticiones HTTP que recibe, que es lo que se quiere comprobar: en modo `503` contesta
 * siempre 503 y en modo `cuelga` no contesta nunca.
 */
function crearServidor(modo: TModo): {server: Server; peticiones: () => number} {
    let peticiones = 0;
    const server = createServer((req, res) => {
        peticiones++;
        req.resume();
        if (modo === "cuelga") {
            return;
        }
        res.statusCode = 503;
        res.setHeader("content-type", "application/json");
        res.setHeader("x-elastic-product", "Elasticsearch");
        res.end(JSON.stringify({error: "unavailable"}));
    });

    return {server, peticiones: () => peticiones};
}

describe("Elasticsearch: requestTimeout y maxRetries del cliente", () => {
    let tmp: string;
    const servidores: Server[] = [];

    /**
     * Levanta el servidor roto y devuelve un cliente contra el con las opciones que se pasen.
     */
    async function cliente(modo: TModo, opciones: {requestTimeout?: number; maxRetries?: number}): Promise<{elastic: Elasticsearch; peticiones: () => number}> {
        const roto = crearServidor(modo);
        servidores.push(roto.server);
        const escuchando = new Deferred<void>();
        roto.server.listen(0, "127.0.0.1", () => {
            escuchando.resolve();
        });
        await escuchando.promise;
        const {port} = roto.server.address() as AddressInfo;

        const credenciales = join(tmp, `elastic-${servidores.length}.json`);
        writeFileSync(credenciales, JSON.stringify({hosts: [`http://127.0.0.1:${port}`], apiKey: "prueba"}));

        return {elastic: new Elasticsearch({credenciales, ...opciones}), peticiones: roto.peticiones};
    }

    before(() => {
        // Las define el bundler en cada servicio; con tsc + Node hay que fijarlas aquí.
        globalThis.DESARROLLO = false;
        globalThis.PRODUCCION = false;
        globalThis.TEST = false;

        tmp = mkdtempSync(join(tmpdir(), "elastic-opciones-"));
    });

    after(() => {
        for (const server of servidores) {
            server.closeAllConnections();
            server.close();
        }
        rmSync(tmp, {recursive: true, force: true});
    });

    it("sin opciones el cliente reintenta (el comportamiento de siempre no cambia)", async () => {
        const {elastic, peticiones} = await cliente("503", {});
        await assert.rejects(elastic.info());
        assert.ok(peticiones() > 1, `esperaba reintentos y hubo ${peticiones()} peticion(es)`);
    });

    it("con maxRetries 0 una peticion que falla con 503 llega UNA sola vez", async () => {
        const {elastic, peticiones} = await cliente("503", {maxRetries: 0});
        await assert.rejects(elastic.info());
        assert.equal(peticiones(), 1);
    });

    it("con requestTimeout y maxRetries 0, un Elasticsearch que no contesta se abandona a tiempo y sin reintentos", async () => {
        const {elastic, peticiones} = await cliente("cuelga", {requestTimeout: 150, maxRetries: 0});
        const inicio = Date.now();
        await assert.rejects(elastic.info(), {name: "TimeoutError"});
        assert.ok(Date.now() - inicio < 3000, "no respeto el requestTimeout");
        assert.equal(peticiones(), 1);
    });
});
