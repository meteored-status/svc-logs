/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: ed544e2073b20d2ffc408ef699190c5b
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {type IEstadoWorker, agregarEstados, calcularEstado} from "../heartbeat/estado";
import {RegistroWorkers, esMensajeHeartbeatWorker} from "../heartbeat/workers";

/**
 * Estado de un proceso y agregado de un pod en modo cluster: lógica pura cuyo error solo se vería en el
 * panel de status, con pods que parecen vivos o muertos sin serlo.
 */

describe("calcularEstado", () => {
    const base = {arrancado: true, listo: true, senal: false, prestop: false};

    it("sin arrancar es arrancando, esté lo que esté la sonda", () => {
        assert.deepEqual(calcularEstado({...base, arrancado: false}), {estado: "arrancando", causaDrenado: null});
        assert.deepEqual(calcularEstado({...base, arrancado: false, listo: true}), {estado: "arrancando", causaDrenado: null});
    });

    it("arrancado: listo o no-listo según la sonda", () => {
        assert.deepEqual(calcularEstado(base), {estado: "listo", causaDrenado: null});
        assert.deepEqual(calcularEstado({...base, listo: false}), {estado: "no-listo", causaDrenado: null});
    });

    it("drenando gana a todo, y senal gana a prestop", () => {
        assert.deepEqual(calcularEstado({...base, prestop: true}), {estado: "drenando", causaDrenado: "prestop"});
        assert.deepEqual(calcularEstado({...base, senal: true}), {estado: "drenando", causaDrenado: "senal"});
        assert.deepEqual(calcularEstado({...base, senal: true, prestop: true}), {estado: "drenando", causaDrenado: "senal"});
        assert.deepEqual(calcularEstado({arrancado: false, listo: false, senal: false, prestop: true}), {estado: "drenando", causaDrenado: "prestop"});
    });
});

describe("agregarEstados", () => {
    const AHORA = 100_000;
    const w = (estado: IEstadoWorker["estado"], hace = 0, causaDrenado: IEstadoWorker["causaDrenado"] = null): IEstadoWorker => ({estado, causaDrenado, ts: AHORA - hace});

    it("todos listos: listo", () => {
        assert.deepEqual(agregarEstados([w("listo"), w("listo")], AHORA), {estado: "listo", causaDrenado: null, procesos: {total: 2, listos: 2}});
    });

    it("uno drena: drenando, con la causa más fuerte", () => {
        const r = agregarEstados([w("listo"), w("drenando", 0, "prestop"), w("drenando", 0, "senal")], AHORA);
        assert.equal(r.estado, "drenando");
        assert.equal(r.causaDrenado, "senal");
        assert.deepEqual(r.procesos, {total: 3, listos: 1});
        assert.equal(agregarEstados([w("listo"), w("drenando", 0, "prestop")], AHORA).causaDrenado, "prestop");
    });

    it("ninguno listo y alguno arrancando: arrancando; con alguno listo y otro arrancando: no-listo", () => {
        assert.equal(agregarEstados([w("arrancando"), w("no-listo")], AHORA).estado, "arrancando");
        assert.equal(agregarEstados([w("listo"), w("arrancando")], AHORA).estado, "no-listo");
        assert.equal(agregarEstados([w("no-listo"), w("no-listo")], AHORA).estado, "no-listo");
    });

    it("worker callado más de 3 s cuenta como no listo; a los 3 s exactos todavía no", () => {
        const callado = agregarEstados([w("listo"), w("listo", 3001)], AHORA);
        assert.deepEqual(callado, {estado: "no-listo", causaDrenado: null, procesos: {total: 2, listos: 1}});
        assert.equal(agregarEstados([w("listo"), w("listo", 3000)], AHORA).estado, "listo");
    });

    it("un worker callado que estaba arrancando deja de contar como arrancando", () => {
        assert.equal(agregarEstados([w("arrancando", 5000), w("no-listo")], AHORA).estado, "no-listo");
    });

    it("un worker que aún no ha informado no caduca: sigue arrancando aunque pasen más de 3 s", () => {
        const sinInformar: IEstadoWorker = {...w("arrancando", 20_000), informado: false};
        assert.equal(agregarEstados([sinInformar, sinInformar], AHORA).estado, "arrancando");
        assert.equal(agregarEstados([sinInformar, w("no-listo")], AHORA).estado, "arrancando");
        // Uno que ya informó sí caduca.
        assert.equal(agregarEstados([{...w("arrancando", 20_000), informado: true}], AHORA).estado, "no-listo");
    });

    it("sin workers: arrancando; un worker parado no cuenta", () => {
        assert.deepEqual(agregarEstados([], 5000), {estado: "arrancando", causaDrenado: null, procesos: {total: 0, listos: 0}});
        assert.deepEqual(agregarEstados([w("listo"), w("parado")], AHORA).procesos, {total: 1, listos: 1});
    });

    it("el timeout se puede cambiar", () => {
        assert.equal(agregarEstados([w("listo", 500)], AHORA, {timeoutMs: 100}).estado, "no-listo");
    });
});

describe("RegistroWorkers", () => {
    it("un worker recién dado de alta es arrancando; el que muere sale del total", () => {
        const registro = new RegistroWorkers();
        registro.alta(1, 1000);
        registro.alta(2, 1000);
        assert.equal(registro.agregar(1500).estado, "arrancando");
        registro.baja(2);
        assert.equal(registro.agregar(1500).procesos?.total, 1);
    });

    it("al arrancar, un worker lento en cargar no hace volver el pod de no-listo a arrancando", () => {
        // Medido en status-backend: los workers tardaron 17 s en informar y el pod salía arrancando → no-listo → arrancando.
        const registro = new RegistroWorkers();
        registro.alta(1, 0);
        registro.alta(2, 0);
        const estados = [registro.agregar(1000).estado, registro.agregar(17_000).estado];
        registro.informe(1, {estado: "arrancando", causaDrenado: null}, 17_000);
        estados.push(registro.agregar(17_100).estado);
        registro.informe(1, {estado: "listo", causaDrenado: null}, 17_500);
        estados.push(registro.agregar(17_600).estado);
        registro.informe(2, {estado: "listo", causaDrenado: null}, 18_000);
        estados.push(registro.agregar(18_100).estado);
        // Uno listo y otro arrancando es no-listo (regla de siempre): avanza, no vuelve atrás.
        assert.deepEqual(estados, ["arrancando", "arrancando", "arrancando", "no-listo", "listo"]);
        // Ya informados, callarse sí los deja en no-listo.
        assert.equal(registro.agregar(30_000).estado, "no-listo");
    });

    it("informe devuelve si cambió el estado y avanza la hora; los desconocidos se ignoran", () => {
        const registro = new RegistroWorkers();
        registro.alta(1, 1000);
        assert.equal(registro.informe(1, {estado: "listo", causaDrenado: null}, 2000), true);
        assert.equal(registro.informe(1, {estado: "listo", causaDrenado: null}, 3000), false);
        assert.equal(registro.informe(9, {estado: "listo", causaDrenado: null}, 3000), false);
        // La hora del último informe cuenta: a 3000 aún está fresco, a 6100 no.
        assert.equal(registro.agregar(3500).estado, "listo");
        assert.equal(registro.agregar(6100).estado, "no-listo");
    });

    it("tras drenar, si mueren todos los workers el agregado sigue drenando (con su causa) y no vuelve a arrancando", () => {
        const registro = new RegistroWorkers();
        registro.alta(1, 1000);
        registro.alta(2, 1000);
        registro.informe(1, {estado: "drenando", causaDrenado: "prestop"}, 2000);
        registro.informe(2, {estado: "drenando", causaDrenado: "senal"}, 2000);
        registro.baja(1);
        registro.baja(2);
        assert.deepEqual(registro.agregar(2500), {estado: "drenando", causaDrenado: "senal", procesos: {total: 0, listos: 0}});
    });

    it("la causa recordada es la más fuerte aunque el último informe fuera otro, y sin haber drenado sigue siendo arrancando", () => {
        const registro = new RegistroWorkers();
        registro.alta(1, 1000);
        assert.equal(registro.agregar(1500).estado, "arrancando");
        registro.baja(1);
        assert.equal(registro.agregar(1500).estado, "arrancando");

        registro.alta(2, 1000);
        registro.informe(2, {estado: "drenando", causaDrenado: "senal"}, 2000);
        registro.informe(2, {estado: "drenando", causaDrenado: "prestop"}, 2100);
        registro.baja(2);
        assert.equal(registro.agregar(2500).causaDrenado, "senal");
    });

    it("agregarEstados sin workers y con drenadoAntes da drenando; sin él, arrancando", () => {
        assert.equal(agregarEstados([], 5000).estado, "arrancando");
        assert.deepEqual(agregarEstados([], 5000, {drenadoAntes: {causaDrenado: "prestop"}}), {estado: "drenando", causaDrenado: "prestop", procesos: {total: 0, listos: 0}});
    });

    it("esMensajeHeartbeatWorker valida la forma del mensaje IPC", () => {
        assert.equal(esMensajeHeartbeatWorker({cmd: "heartbeat", estado: "listo", causaDrenado: null}), true);
        assert.equal(esMensajeHeartbeatWorker({cmd: "heartbeat", estado: "otro", causaDrenado: null}), false);
        assert.equal(esMensajeHeartbeatWorker({cmd: "spawn"}), false);
        assert.equal(esMensajeHeartbeatWorker(null), false);
    });
});
