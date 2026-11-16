/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 2c5a645cb673350511a2c5673b2a78ff
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.14+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {afterEach, beforeEach, describe, it} from "node:test";
import assert from "node:assert/strict";

import {DestinoHTTP} from "../modules/destino/http";
import {ESeveridad} from "../modules/interface";
import {Logger} from "../modules/logger";

/**
 * Las pruebas de verdad del destino viven aquí y no en el de WebSocket, y no es casualidad: `DestinoHTTP`
 * solo usa `fetch`, así que se puede cargar en este arnés. `DestinoWebSocket` importa `WSPool`, y los
 * `exports` del monorepo apuntan a `.ts`, que no se resuelven en runtime sin bundler.
 *
 * Como toda la lógica —buffer, urgencia, cola, techo de pendientes, avisos— está en `DestinoBuffer`, lo
 * que se comprueba aquí vale igual para los dos.
 */

interface IPeticion {
    url: string;
    metodo: string;
    tipo: string;
    lote: {mensaje: string; severidad: number; region?: string; host?: string}[];
}

const URL_PRUEBA = "http://ingesta.local/service/logs/service/";

let peticiones: IPeticion[];
let respuesta: {ok: boolean; status: number};
let fetchOriginal: typeof fetch;

/** Deja pasar suficientes microtareas para que la cola de envío se drene. */
const asentar = async (): Promise<void> => {
    for (let i = 0; i < 200; i++) {
        await new Promise((resolver) => { setImmediate(resolver); });
    }
};

const construir = (config: ConstructorParameters<typeof DestinoHTTP>[0] = {}): {destino: DestinoHTTP; log: Logger} => {
    const destino = new DestinoHTTP({url: URL_PRUEBA, ...config});

    return {destino, log: Logger.build({proyecto: "P", servicio: "S", destinos: [destino]})};
};

const enviados = (): {mensaje: string; severidad: number; region?: string; host?: string}[] => peticiones.flatMap(actual => actual.lote);

beforeEach(() => {
    peticiones = [];
    respuesta = {ok: true, status: 200};
    fetchOriginal = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit): Promise<Response> => {
        peticiones.push({
            url: `${url}`,
            metodo: init.method ?? "",
            tipo: (init.headers as Record<string, string>)["content-type"] ?? "",
            lote: JSON.parse(`${init.body}`),
        });

        return {
            ok: respuesta.ok,
            status: respuesta.status,
            statusText: "",
            arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(0),
        } as Response;
    }) as typeof fetch;
});

afterEach(() => {
    globalThis.fetch = fetchOriginal;
});

describe("DestinoHTTP", () => {
    it("hace un POST de JSON con la lista de logs", async () => {
        const {log} = construir({lote: 1});
        log.info("arranque", "el servicio ha arrancado");
        await asentar();

        assert.equal(peticiones.length, 1);
        assert.equal(peticiones[0]?.url, URL_PRUEBA);
        assert.equal(peticiones[0]?.metodo, "POST");
        assert.equal(peticiones[0]?.tipo, "application/json");
        assert.ok(Array.isArray(peticiones[0]?.lote), "el cuerpo tiene que ser una lista");
        assert.equal(peticiones[0]?.lote[0]?.mensaje, "el servicio ha arrancado");
    });

    it("agrupa por lote y saca el resto al vencer la espera", async () => {
        const {log} = construir({lote: 20, esperaMs: 30});
        for (let i = 0; i < 53; i++) {
            log.info("rafaga", `log ${i}`);
        }
        await asentar();
        await new Promise((resolver) => { setTimeout(resolver, 80); });
        await asentar();

        assert.deepEqual(peticiones.map(actual => actual.lote.length), [20, 20, 13]);
        assert.deepEqual(enviados().map(actual => actual.mensaje), Array.from({length: 53}, (_, i) => `log ${i}`));
    });

    it("de ERROR para arriba no espera, y no arrastra a los que sí esperan", async () => {
        const {log} = construir({lote: 500, esperaMs: 600000});
        log.info("t", "espero");
        log.error("t", "no espero");
        await asentar();

        assert.equal(peticiones.length, 1);
        assert.deepEqual(peticiones[0]?.lote.map(actual => actual.mensaje), ["no espero"]);
    });

    it("una tormenta de errores en el mismo tick sale en una sola petición", async () => {
        const {log} = construir({lote: 500, esperaMs: 600000});
        for (let i = 0; i < 40; i++) {
            log.error("caida", `error ${i}`);
        }
        await asentar();

        assert.equal(peticiones.length, 1);
        assert.equal(peticiones[0]?.lote.length, 40);
    });

    it("vaciar() resuelve con todo entregado, y deja el destino usable", async () => {
        const {log} = construir({lote: 500, esperaMs: 600000});
        log.info("t", "uno");
        log.info("t", "dos");

        await log.vaciar();
        assert.equal(enviados().length, 2, "al volver de vaciar() ya tiene que estar entregado");

        log.info("t", "tres");
        await log.vaciar();
        assert.equal(enviados().length, 3);
    });

    it("un 500 se traza: `fetch` no rechaza por sí solo con un 5xx", async () => {
        respuesta = {ok: false, status: 500};
        const avisos: string[] = [];
        const original = console.error;
        console.error = (...partes: unknown[]): void => { avisos.push(partes.map(String).join(" ")); };
        try {
            const {log} = construir({lote: 1});
            log.info("t", "m");
            await asentar();
        } finally {
            console.error = original;
        }

        assert.equal(avisos.length, 1);
        assert.match(avisos[0] ?? "", /500/);
    });

    it("la región y el host llegan al cuerpo de la petición", async () => {
        // No basta con que el `Logger` los ponga en el log: el destino monta el cuerpo campo a campo
        // (`serializar()`), así que un campo nuevo que no se añada ahí se queda en el emisor y nadie se
        // entera — el `Logger` lo lleva, sus pruebas pasan, y a la ingesta no llega nada.
        const destino = new DestinoHTTP({url: URL_PRUEBA});
        Logger.build({proyecto: "P", servicio: "S", destinos: [destino], region: "belgica", host: "pod-7"})
            .info("t", "m");

        await destino.vaciar();

        assert.equal(enviados()[0]?.region, "belgica");
        assert.equal(enviados()[0]?.host, "pod-7");
    });

    it("sin región ni host, el cuerpo no los lleva", async () => {
        const {destino, log} = construir();
        log.info("t", "m");

        await destino.vaciar();

        assert.equal("region" in enviados()[0]!, false);
        assert.equal("host" in enviados()[0]!, false);
    });

    it("con la cola llena descarta, sin lanzar a quien loguea", async () => {
        respuesta = {ok: false, status: 500};
        const original = console.error;
        console.error = (): void => {};
        try {
            const {log} = construir({lote: 1, pendientes: 5, avisoMs: 0});
            assert.doesNotThrow(() => {
                for (let i = 0; i < 40; i++) {
                    log.info("t", `m${i}`);
                }
            });
            await asentar();
        } finally {
            console.error = original;
        }
    });
});
