/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: be3a20bd9b806f1e07ca6b9a31511b8e
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.14+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {type IDestino, type ILogEmitido, EEntorno, ESeveridad, entornoActual} from "../modules/interface";
import {Logger} from "../modules/logger";

/**
 * Destino de mentira: se queda con lo que recibe.
 *
 * Con esto se prueba el `Logger`, que es lo que se puede probar aquí: no importa nada de fuera del
 * workspace. `DestinoWebSocket` sí —necesita `WSPool`—, y los `exports` de los paquetes del monorepo
 * apuntan a `.ts`, que no se puede cargar en tiempo de ejecución sin pasar por el bundler. Ver el
 * CODEMAP.
 */
class DestinoEspia implements IDestino {
    public readonly recibidos: ILogEmitido[];

    /** Cuántas veces le han pedido vaciar. */
    public vaciados: number;

    public constructor() {
        this.recibidos = [];
        this.vaciados = 0;
    }

    public enviar(log: ILogEmitido): void {
        this.recibidos.push(log);
    }

    public async vaciar(): Promise<void> {
        this.vaciados++;
    }
}

const construir = (...destinos: IDestino[]): Logger => Logger.build({
    proyecto: "MI-PROYECTO",
    servicio: "svc-prueba",
    destinos,
});

/**
 * Pone las constantes que normalmente inlina el bundler y devuelve el estado anterior, para poder
 * restaurarlo. Aquí no las hay —esto corre con `tsc` + `node`, sin bundler—, que es justo por lo que
 * {@link entornoActual} las mira con `typeof`.
 */
const conGlobales = (produccion: boolean|undefined, test: boolean|undefined, que: () => void): void => {
    const globales = globalThis as Record<string, unknown>;
    const antes = {PRODUCCION: globales["PRODUCCION"], TEST: globales["TEST"]};
    globales["PRODUCCION"] = produccion;
    globales["TEST"] = test;
    try {
        que();
    } finally {
        globales["PRODUCCION"] = antes.PRODUCCION;
        globales["TEST"] = antes.TEST;
    }
};

describe("entornoActual", () => {
    it("sin las constantes del bundler, desarrollo", () => {
        conGlobales(undefined, undefined, () => {
            assert.equal(entornoActual(), EEntorno.DESARROLLO);
        });
    });

    it("PRODUCCION sin TEST es producción", () => {
        conGlobales(true, false, () => {
            assert.equal(entornoActual(), EEntorno.PRODUCCION);
        });
    });

    it("test también trae PRODUCCION, y gana TEST", () => {
        // Es la combinación real que documenta `@mr/core-dev`, y la que se equivocaría si se preguntase
        // por PRODUCCION primero.
        conGlobales(true, true, () => {
            assert.equal(entornoActual(), EEntorno.TEST);
        });
    });

    it("las dos a false es desarrollo", () => {
        conGlobales(false, false, () => {
            assert.equal(entornoActual(), EEntorno.DESARROLLO);
        });
    });
});

describe("Logger", () => {
    it("pone proyecto, servicio y entorno en cada log", () => {
        const espia = new DestinoEspia();
        construir(espia).info("arranque", "el servicio ha arrancado");

        assert.equal(espia.recibidos.length, 1);
        assert.equal(espia.recibidos[0]?.proyecto, "MI-PROYECTO");
        assert.equal(espia.recibidos[0]?.servicio, "svc-prueba");
        assert.equal(espia.recibidos[0]?.entorno, EEntorno.DESARROLLO);
        assert.equal(espia.recibidos[0]?.tipo, "arranque");
        assert.equal(espia.recibidos[0]?.mensaje, "el servicio ha arrancado");
    });

    it("cada atajo lleva su severidad, y `escribir` cae en INFO", () => {
        const espia = new DestinoEspia();
        const log = construir(espia);
        log.info("t", "m");
        log.warning("t", "m");
        log.error("t", "m");
        log.critical("t", "m");
        log.escribir({tipo: "t", mensaje: "m"});

        assert.deepEqual(espia.recibidos.map(actual => actual.severidad), [
            ESeveridad.INFO,
            ESeveridad.WARNING,
            ESeveridad.ERROR,
            ESeveridad.CRITICAL,
            ESeveridad.INFO,
        ]);
    });

    it("fecha el log al escribirlo, y respeta el timestamp que le den", () => {
        const espia = new DestinoEspia();
        const antes = Date.now();
        const log = construir(espia);
        log.info("t", "m");
        log.escribir({tipo: "t", mensaje: "m", timestamp: 1757000000000});

        const puesto = espia.recibidos[0]?.timestamp ?? 0;
        assert.ok(puesto >= antes && puesto <= Date.now(), `${puesto} fuera del intervalo`);
        assert.equal(espia.recibidos[1]?.timestamp, 1757000000000);
    });

    it("un extra vacío no viaja", () => {
        const espia = new DestinoEspia();
        const log = construir(espia);
        log.info("t", "sin extra");
        log.info("t", "vacío", []);
        log.error("t", "con extra", ["a", "b"]);

        assert.equal("extra" in (espia.recibidos[0] ?? {}), false);
        assert.equal("extra" in (espia.recibidos[1] ?? {}), false);
        assert.deepEqual(espia.recibidos[2]?.extra, ["a", "b"]);
    });

    it("reparte el mismo log entre todos los destinos", () => {
        const uno = new DestinoEspia();
        const otro = new DestinoEspia();
        construir(uno, otro).info("t", "m");

        assert.equal(uno.recibidos.length, 1);
        assert.equal(otro.recibidos.length, 1);
        assert.deepEqual(uno.recibidos[0], otro.recibidos[0]);
    });

    it("un destino que lanza no tumba al que loguea ni tapa a los demás", () => {
        const roto: IDestino = {
            enviar(): void {
                throw new Error("destino mal implementado");
            },
        };
        const bueno = new DestinoEspia();

        const original = console.error;
        console.error = (): void => {};
        try {
            assert.doesNotThrow(() => { construir(roto, bueno).info("t", "m"); });
        } finally {
            console.error = original;
        }

        assert.equal(bueno.recibidos.length, 1);
    });

    it("el entorno se puede imponer, y si no se deduce", () => {
        const impuesto = new DestinoEspia();
        Logger.build({proyecto: "P", servicio: "S", destinos: [impuesto], entorno: EEntorno.PRODUCCION}).info("t", "m");
        assert.equal(impuesto.recibidos[0]?.entorno, EEntorno.PRODUCCION);

        const deducido = new DestinoEspia();
        conGlobales(true, true, () => {
            Logger.build({proyecto: "P", servicio: "S", destinos: [deducido]}).info("t", "m");
        });
        assert.equal(deducido.recibidos[0]?.entorno, EEntorno.TEST);
    });

    it("vaciar() se lo pide a todos los destinos, y no le molesta el que no sepa", async () => {
        const uno = new DestinoEspia();
        const otro = new DestinoEspia();
        // Un destino sin nada que vaciar no implementa `vaciar()`; esto no puede reventar por él.
        const simple: IDestino = {enviar(): void {}};

        await Logger.build({proyecto: "P", servicio: "S", destinos: [uno, simple, otro]}).vaciar();

        assert.equal(uno.vaciados, 1);
        assert.equal(otro.vaciados, 1);
    });

    it("sin destinos no falla: descarta", () => {
        assert.doesNotThrow(() => { construir().info("t", "m"); });
    });
});

/**
 * `region` y `host` dicen **dónde** se escribió el log, y su gracia está en lo que separan: el mismo
 * servicio corre en varios clusteres y con varias réplicas, y sin esto una pasada de Bélgica y otra de
 * Madrid, o dos pods de los que solo uno falla, se leen como si fueran el mismo proceso.
 *
 * Lo que se fija aquí es que **no se inventan**. Los dos son opcionales y sin valor por defecto porque el
 * módulo tiene que poder cargarse en el navegador, donde no hay ni `os.hostname()` ni `process.env`; un
 * hueco en el registro se distingue de un dato, y un `""` no.
 */
describe("Logger: región y host", () => {

    it("los pone en cada log cuando se los dan", () => {
        const destino = new DestinoEspia();
        Logger.build({proyecto: "P", servicio: "S", destinos: [destino], region: "belgica", host: "pod-7"})
            .info("t", "m");

        assert.equal(destino.recibidos[0]?.region, "belgica");
        assert.equal(destino.recibidos[0]?.host, "pod-7");
    });

    it("sin ellos, el log no los lleva — ni vacíos ni inventados", () => {
        // `undefined` y no `""`: el campo tiene que **faltar**, para que quien lo lea distinga «no se sabe»
        // de «se sabe y está en blanco». Es el mismo criterio que el `entorno` de la ingesta.
        const destino = new DestinoEspia();
        Logger.build({proyecto: "P", servicio: "S", destinos: [destino]}).info("t", "m");

        assert.equal(destino.recibidos[0]?.region, undefined);
        assert.equal(destino.recibidos[0]?.host, undefined);
        assert.equal("region" in destino.recibidos[0]!, false);
        assert.equal("host" in destino.recibidos[0]!, false);
    });

    it("una cadena vacía cuenta como no tenerlos", () => {
        // Es lo que sale de un `process.env.ZONA` que no está puesto, que es el caso normal en local. Sin
        // este corte, el registro se llenaría de logs con la región en blanco.
        const destino = new DestinoEspia();
        Logger.build({proyecto: "P", servicio: "S", destinos: [destino], region: "", host: ""})
            .info("t", "m");

        assert.equal("region" in destino.recibidos[0]!, false);
        assert.equal("host" in destino.recibidos[0]!, false);
    });

    it("son del logger y no del log, así que van en todos", () => {
        // Son dos de las cosas que no se repiten en cada llamada: quien loguea escribe `info(tipo, mensaje)`
        // y no tiene que acordarse de dónde está corriendo.
        const destino = new DestinoEspia();
        const log = Logger.build({proyecto: "P", servicio: "S", destinos: [destino], region: "madrid", host: "pod-1"});

        log.info("t", "uno");
        log.error("t", "dos");

        assert.deepStrictEqual(destino.recibidos.map(item => item.host), ["pod-1", "pod-1"]);
        assert.deepStrictEqual(destino.recibidos.map(item => item.region), ["madrid", "madrid"]);
    });
});
