/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 51177ac7fc053628b0ab4458c8c38a97
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {avisos, limpiarAvisos} from "./stubs/log";
import {type IRespuestaMetadatos, interpretarRespuesta, leerMetadatos, resolverMetadatos} from "../heartbeat/metadatos";

/**
 * Lectura del servidor de metadatos de GKE: lo importante es qué se descarta y quién manda cuando hay
 * variable de entorno.
 */

const ok = (cuerpo: string): IRespuestaMetadatos => ({status: 200, flavor: "Google", cuerpo});

describe("interpretarRespuesta", () => {
    it("un 200 con Metadata-Flavor: Google vale, y se limpia", () => {
        assert.equal(interpretarRespuesta(ok("status-madrid-2\n")), "status-madrid-2");
    });

    it("sin la cabecera, o con otra, se descarta", () => {
        assert.equal(interpretarRespuesta({status: 200, flavor: undefined, cuerpo: "x"}), null);
        assert.equal(interpretarRespuesta({status: 200, flavor: "Otro", cuerpo: "x"}), null);
    });

    it("timeout (null), estado distinto de 200 o cuerpo vacío se descartan", () => {
        assert.equal(interpretarRespuesta(null), null);
        assert.equal(interpretarRespuesta({status: 404, flavor: "Google", cuerpo: "x"}), null);
        assert.equal(interpretarRespuesta(ok("  \n")), null);
    });
});

describe("resolverMetadatos", () => {
    it("la variable de entorno manda sobre el servidor de metadatos", () => {
        const r = resolverMetadatos({HEARTBEAT_CLUSTER: "forzado"}, {cluster: "gke", proyecto: "p", ubicacion: null});
        assert.deepEqual(r.cluster, {valor: "forzado", origen: "env"});
        assert.deepEqual(r.proyecto, {valor: "p", origen: "metadata"});
        assert.deepEqual(r.ubicacion, {valor: "", origen: "vacío"});
    });

    it("una variable definida pero vacía no cuenta", () => {
        assert.equal(resolverMetadatos({HEARTBEAT_PROYECTO: ""}, {cluster: null, proyecto: "p", ubicacion: null}).proyecto.origen, "metadata");
    });
});

describe("leerMetadatos", () => {
    it("pide las tres rutas y compone el resultado", async () => {
        const pedidas: string[] = [];
        const r = await leerMetadatos({env: {}, leer: async (ruta) => {
            pedidas.push(ruta);
            return ok(ruta.endsWith("cluster-name") ? "c" : ruta.endsWith("cluster-location") ? "u" : "p");
        }});
        assert.deepEqual(pedidas.sort(), [
            "/computeMetadata/v1/instance/attributes/cluster-location",
            "/computeMetadata/v1/instance/attributes/cluster-name",
            "/computeMetadata/v1/project/project-id",
        ]);
        assert.deepEqual([r.cluster.valor, r.ubicacion.valor, r.proyecto.valor], ["c", "u", "p"]);
    });

    it("si todo falla, vacío y un solo aviso; nunca rechaza", async () => {
        limpiarAvisos();
        const r = await leerMetadatos({env: {}, leer: async () => { throw new Error("sin red"); }});
        assert.deepEqual([r.cluster.origen, r.proyecto.origen, r.ubicacion.origen], ["vacío", "vacío", "vacío"]);
        assert.equal(avisos.length, 1);
    });

    it("lo que define el entorno no se pide, y si no queda nada que pedir no hay aviso", async () => {
        limpiarAvisos();
        const pedidas: string[] = [];
        const r = await leerMetadatos({
            env: {HEARTBEAT_CLUSTER: "a", HEARTBEAT_PROYECTO: "b", HEARTBEAT_UBICACION: "c"},
            leer: async (ruta) => { pedidas.push(ruta); return null; },
        });
        assert.deepEqual(pedidas, []);
        assert.deepEqual([r.cluster.origen, r.proyecto.origen, r.ubicacion.origen], ["env", "env", "env"]);
        assert.equal(avisos.length, 0);
    });

    it("con consultar=false (fuera del clúster) no pide nada ni avisa", async () => {
        limpiarAvisos();
        let llamadas = 0;
        const r = await leerMetadatos({env: {}, consultar: false, leer: async () => { llamadas++; return null; }});
        assert.equal(llamadas, 0);
        assert.equal(r.cluster.origen, "vacío");
        assert.equal(avisos.length, 0);
    });
});

describe("leerMetadatos con reintento (producción)", () => {
    const respuestasBuenas = (ruta: string): IRespuestaMetadatos => ok(ruta.endsWith("cluster-name") ? "status-madrid-2" : ruta.endsWith("cluster-location") ? "europe-southwest1" : "meteored-status");

    it("no resuelve hasta tener los tres: espera con backoff 1, 2, 4… y avisa una sola vez", async () => {
        limpiarAvisos();
        const esperas: number[] = [];
        let intento = 0;
        const r = await leerMetadatos({
            env: {},
            reintentar: true,
            esperar: async (ms) => { esperas.push(ms); },
            leer: async (ruta) => (++intento > 9 ? respuestasBuenas(ruta) : null),
        });
        // Los intentos 1-3 son la ronda 1 (falla todo), 4-6 la 2, 7-9 la 3; la ronda 4 acierta.
        assert.deepEqual(esperas, [1000, 2000, 4000]);
        assert.deepEqual([r.cluster.valor, r.ubicacion.valor, r.proyecto.valor], ["status-madrid-2", "europe-southwest1", "meteored-status"]);
        assert.deepEqual([r.cluster.origen, r.ubicacion.origen, r.proyecto.origen], ["metadata", "metadata", "metadata"]);
        assert.equal(avisos.length, 1);
    });

    it("el backoff se queda en 30 s", async () => {
        const esperas: number[] = [];
        let rondas = 0;
        await leerMetadatos({
            env: {},
            reintentar: true,
            esperar: async (ms) => { esperas.push(ms); },
            leer: async (ruta) => (rondas >= 8 ? respuestasBuenas(ruta) : (ruta.endsWith("project-id") && ++rondas, null)),
        });
        assert.deepEqual(esperas, [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
    });

    it("solo se reintentan los que faltan", async () => {
        const pedidas: string[] = [];
        let ronda = 0;
        const r = await leerMetadatos({
            env: {},
            reintentar: true,
            esperar: async () => { ronda++; },
            leer: async (ruta) => {
                pedidas.push(`${ronda}:${ruta.split("/").pop()}`);
                // El proyecto es el único que falla en la primera ronda.
                return ruta.endsWith("project-id") && ronda === 0 ? null : respuestasBuenas(ruta);
            },
        });
        assert.deepEqual(pedidas, ["0:cluster-name", "0:cluster-location", "0:project-id", "1:project-id"]);
        assert.equal(r.proyecto.valor, "meteored-status");
    });

    it("las HEARTBEAT_* completas evitan la espera, y una sola que falte la mantiene", async () => {
        let esperas = 0;
        const completo = await leerMetadatos({
            env: {HEARTBEAT_CLUSTER: "a", HEARTBEAT_PROYECTO: "b", HEARTBEAT_UBICACION: "c"},
            reintentar: true,
            esperar: async () => { esperas++; },
            leer: async () => null,
        });
        assert.equal(esperas, 0);
        assert.equal(completo.cluster.origen, "env");

        let intentos = 0;
        await leerMetadatos({
            env: {HEARTBEAT_CLUSTER: "a", HEARTBEAT_PROYECTO: "b"},
            reintentar: true,
            esperar: async () => { esperas++; },
            leer: async (ruta) => (++intentos > 1 ? respuestasBuenas(ruta) : null),
        });
        assert.equal(esperas, 1);
    });

    it("sin reintentar (fuera de producción) no espera nunca", async () => {
        let esperas = 0;
        await leerMetadatos({env: {}, esperar: async () => { esperas++; }, leer: async () => null});
        assert.equal(esperas, 0);
    });
});
