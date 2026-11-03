/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 20 Oct 2026 10:27:34 GMT
 * Hash: 7e79a8733b4d6198590a057c482aa61c
 * Versión: 2026.10.20+3-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-web-widget.git
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

/**
 * Servidor que se hace pasar por Elasticsearch: responde a cualquier petición con un cuerpo de bulk
 * vacío y la cabecera `x-elastic-product`, que el cliente oficial exige. Cuenta las conexiones TCP
 * que recibe, que es lo que se quiere comprobar.
 */
function crearServidor(): {server: Server; conexiones: () => number} {
    let conexiones = 0;
    const server = createServer((req, res) => {
        req.resume();
        req.on("end", () => {
            res.setHeader("content-type", "application/json");
            res.setHeader("x-elastic-product", "Elasticsearch");
            res.end(JSON.stringify({took: 1, errors: false, items: []}));
        });
    });
    server.on("connection", () => {
        conexiones++;
    });
    return {server, conexiones: () => conexiones};
}

describe("Elasticsearch.bulk", () => {
    const BULK = {operations: [{create: {_index: "prueba"}}, {campo: 1}]};
    let tmp: string;
    let servidor: ReturnType<typeof crearServidor>;
    let elastic: Elasticsearch;

    before(async () => {
        // Las define el bundler en cada servicio; con tsc + Node hay que fijarlas aquí.
        globalThis.DESARROLLO = false;
        globalThis.PRODUCCION = false;
        globalThis.TEST = false;

        servidor = crearServidor();
        const escuchando = new Deferred<void>();
        servidor.server.listen(0, "127.0.0.1", () => {
            escuchando.resolve();
        });
        await escuchando.promise;
        const {port} = servidor.server.address() as AddressInfo;

        tmp = mkdtempSync(join(tmpdir(), "elastic-bulk-"));
        const credenciales = join(tmp, "elastic.json");
        writeFileSync(credenciales, JSON.stringify({hosts: [`http://127.0.0.1:${port}`], apiKey: "prueba"}));
        elastic = new Elasticsearch({credenciales});
    });

    after(() => {
        servidor.server.closeAllConnections();
        servidor.server.close();
        rmSync(tmp, {recursive: true, force: true});
    });

    it("reutiliza la conexión entre bulks consecutivos", async () => {
        for (let i = 0; i < 10; i++) {
            await elastic.bulk(BULK);
        }
        assert.equal(servidor.conexiones(), 1);
    });

    it("comparte cliente y conexiones con el resto de operaciones", async () => {
        // Un cliente cacheado solo para bulks pasaría la prueba anterior; esta no. `info()` puede abrir
        // un segundo socket: sale justo cuando undici aún no ha liberado el del bulk anterior, y el
        // pool crece hasta la concurrencia que vea. A partir de ahí, los bulks no deben abrir ninguno.
        await elastic.info();
        const tras = servidor.conexiones();
        for (let i = 0; i < 10; i++) {
            await elastic.bulk(BULK);
        }
        assert.equal(servidor.conexiones(), tras);
    });
});
