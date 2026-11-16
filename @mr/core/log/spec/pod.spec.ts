/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: be63b0249eedfd87c151689feabdc894
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.14+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {afterEach, describe, it} from "node:test";
import assert from "node:assert/strict";

import {type IDestino, type ILogEmitido} from "../modules/interface";
import {loggerDePod, servicioDePod} from "../modules/pod";

/**
 * El nombre con el que se firma un servicio es de las cosas que más se repiten y peor se notan: si sale
 * mal, los logs siguen llegando y siguen leyéndose, solo que atribuidos a otro sitio. Y ya dio un fallo —un
 * `DD_SERVICE` definido y vacío firmaba **todos** los logs con el servicio en blanco, porque el respaldo
 * iba con `??` en vez de mirar la longitud—, así que lo que se fija aquí es precisamente cada rama.
 *
 * Ahora que la convención vive en el paquete y no en cada emisor, un fallo aquí saldría multiplicado por el
 * número de servicios.
 */

const POD = {servicio: "status-control", zona: "belgica", host: "pod-7"};

const entorno = (valores: Record<string, string|undefined>): void => {
    for (const [clave, valor] of Object.entries(valores)) {
        if (valor === undefined) {
            delete process.env[clave];
        } else {
            process.env[clave] = valor;
        }
    }
};

afterEach(() => {
    entorno({DD_SERVICE: undefined, K8S_NAMESPACE: undefined});
});

describe("servicioDePod", () => {

    it("coge `DD_SERVICE` tal cual, porque el despliegue ya lo compuso", () => {
        // El `run.sh` del Dockerfile lo reescribe a `${K8S_NAMESPACE}/${DD_SERVICE}` antes de arrancar el
        // proceso, así que aquí ya viene con el namespace puesto: rehacerlo sería arriesgarse a hacerlo
        // distinto de como se llama el servicio en Datadog.
        entorno({DD_SERVICE: "services/status-control", K8S_NAMESPACE: "services"});

        assert.equal(servicioDePod(POD), "services/status-control");
    });

    it("sin `DD_SERVICE`, lo compone con el namespace y el nombre del pod", () => {
        entorno({K8S_NAMESPACE: "services"});

        assert.equal(servicioDePod(POD), "services/status-control");
    });

    it("abrevia `meteored` a `mr`, y todas las veces", () => {
        // El `sed` del Dockerfile lleva `/g`; con `replace` a secas, un `meteored-meteored` saldría distinto
        // aquí que allí, y el mismo servicio tendría dos nombres según por dónde se mire.
        entorno({K8S_NAMESPACE: "meteored-status"});
        assert.equal(servicioDePod(POD), "mr-status/status-control");

        entorno({K8S_NAMESPACE: "meteored-meteored"});
        assert.equal(servicioDePod(POD), "mr-mr/status-control");
    });

    it("sin nada del entorno, el nombre a secas", () => {
        // Y **no** `default/…`: el `default` del Dockerfile es suyo, y aquí sin namespace no hay Kubernetes.
        assert.equal(servicioDePod(POD), "status-control");
    });

    it("una variable definida y vacía cuenta como no estar", () => {
        // Es lo que pasa cuando el despliegue la declara sin valor, y el fallo que dio: con `??` en vez de
        // mirar la longitud, esto firmaba todos los logs con el servicio en blanco.
        entorno({DD_SERVICE: "", K8S_NAMESPACE: ""});

        assert.equal(servicioDePod(POD), "status-control");
    });
});

describe("loggerDePod", () => {

    class DestinoEspia implements IDestino {
        public readonly recibidos: ILogEmitido[];

        public constructor() {
            this.recibidos = [];
        }

        public enviar(log: ILogEmitido): void {
            this.recibidos.push(log);
        }
    }

    it("saca del pod el servicio, la región y el host", () => {
        // Es lo que se ahorra cada emisor: tres campos que salen de un dato que el servicio ya tiene
        // resuelto en su configuración.
        entorno({K8S_NAMESPACE: "services"});
        const destino = new DestinoEspia();

        loggerDePod({pod: POD, proyecto: "status", destinos: [destino]}).info("t", "m");

        assert.equal(destino.recibidos[0]?.servicio, "services/status-control");
        assert.equal(destino.recibidos[0]?.region, "belgica");
        assert.equal(destino.recibidos[0]?.host, "pod-7");
    });
});
