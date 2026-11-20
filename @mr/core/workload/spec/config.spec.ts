/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: 5d375732e42233e2db6adecc393a76cc
 * Versión: 2026.11.20+1-bixus
 * Anterior: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {EEntorno} from "@mr/core-log/interface";

import {SOCKET_POR_DEFECTO, construirUrl, decidirHeartbeat, tokenConFormato} from "../heartbeat/config";

/**
 * La decisión de emitir: un error aquí mandaría heartbeats de un cronjob, o de un pod local a producción,
 * y no rompería nada hasta que alguien mirase el panel.
 */

/** Un token con la forma que espera el receptor: `hb1.<id>.<secreto>`. */
const TOKEN = "hb1.2026-11.s3creto_X-9";

const entrada = (env: Record<string, string>, extra: Partial<{entorno: EEntorno; tipo: string; target: string}> = {}) => ({
    env,
    entorno: EEntorno.PRODUCCION,
    tipo: "service",
    target: "k8s",
    ...extra,
});

describe("decidirHeartbeat", () => {
    it("un servicio de k8s en producción con HEARTBEAT y token emite hacia el receptor por defecto", () => {
        const d = decidirHeartbeat(entrada({HEARTBEAT: "true", HEARTBEAT_TOKEN: TOKEN}));
        assert.ok(d.habilitado);
        assert.equal(d.config.socket, `${SOCKET_POR_DEFECTO}/status/external/heartbeat/`);
        assert.equal(d.config.token, TOKEN);
    });

    it("worker, browser o lambda no emiten, y sin avisar (es lo normal)", () => {
        for (const tipo of ["worker", "browser"]) {
            const d = decidirHeartbeat(entrada({HEARTBEAT: "true", HEARTBEAT_TOKEN: TOKEN}, {tipo}));
            assert.equal(d.habilitado, false);
            assert.equal(!d.habilitado && d.avisar, false);
        }
        const lambda = decidirHeartbeat(entrada({HEARTBEAT: "true", HEARTBEAT_TOKEN: TOKEN}, {target: "lambda"}));
        assert.equal(lambda.habilitado, false);
        for (const tipo of ["cronjob", "job"]) {
            const d = decidirHeartbeat(entrada({HEARTBEAT: "true", HEARTBEAT_TOKEN: TOKEN}, {tipo, target: "lambda"}));
            assert.equal(d.habilitado, false, `${tipo} en lambda no emite`);
        }
    });

    it("un cronjob y un job de k8s emiten con HEARTBEAT=true y token, con la misma configuración que un servicio", () => {
        const servicio = decidirHeartbeat(entrada({HEARTBEAT: "true", HEARTBEAT_TOKEN: TOKEN}));
        for (const tipo of ["cronjob", "job"]) {
            const d = decidirHeartbeat(entrada({HEARTBEAT: "true", HEARTBEAT_TOKEN: TOKEN}, {tipo}));
            assert.ok(d.habilitado, tipo);
            assert.deepEqual(d, servicio, tipo);
        }
    });

    it("un cronjob o un job sin HEARTBEAT=true no emiten, y sin avisar", () => {
        for (const tipo of ["cronjob", "job"]) {
            const d = decidirHeartbeat(entrada({HEARTBEAT_TOKEN: TOKEN}, {tipo}));
            assert.equal(d.habilitado, false, tipo);
            assert.equal(!d.habilitado && d.avisar, false, tipo);
        }
    });

    it("las cargas finitas solo emiten en modo simple; un servicio emite también en primario y en worker", () => {
        const env = {HEARTBEAT: "true", HEARTBEAT_TOKEN: TOKEN};
        for (const tipo of ["cronjob", "job"]) {
            assert.ok(decidirHeartbeat({...entrada(env, {tipo}), modo: "simple"}).habilitado, tipo);
            for (const modo of ["primario", "worker"] as const) {
                const d = decidirHeartbeat({...entrada(env, {tipo}), modo});
                assert.equal(d.habilitado, false, `${tipo} ${modo}`);
                assert.equal(!d.habilitado && d.avisar, false, `${tipo} ${modo}`);
            }
        }
        for (const modo of ["simple", "primario", "worker"] as const) {
            assert.ok(decidirHeartbeat({...entrada(env), modo}).habilitado, modo);
        }
    });

    it("sin HEARTBEAT=true no emite, y sin avisar", () => {
        const envs: Record<string, string>[] = [{HEARTBEAT_TOKEN: TOKEN}, {HEARTBEAT: "false", HEARTBEAT_TOKEN: TOKEN}, {HEARTBEAT: "1", HEARTBEAT_TOKEN: TOKEN}];
        for (const env of envs) {
            const d = decidirHeartbeat(entrada(env));
            assert.equal(d.habilitado, false);
            assert.equal(!d.habilitado && d.avisar, false);
        }
    });

    it("fuera de producción sin HEARTBEAT_SOCKET no emite y avisa: nunca se manda un pod local a producción", () => {
        const d = decidirHeartbeat(entrada({HEARTBEAT: "true"}, {entorno: EEntorno.DESARROLLO}));
        assert.equal(d.habilitado, false);
        assert.equal(!d.habilitado && d.avisar, true);
    });

    it("fuera de producción con socket emite aunque no haya token", () => {
        const d = decidirHeartbeat(entrada({HEARTBEAT: "true", HEARTBEAT_SOCKET: "ws://proxy-svc-status-external.services.svc.cluster.local"}, {entorno: EEntorno.DESARROLLO}));
        assert.ok(d.habilitado);
        assert.ok(d.config.token.length > 0);
        assert.equal(d.config.socket, "ws://proxy-svc-status-external.services.svc.cluster.local/status/external/heartbeat/");
    });

    it("en producción y en test, sin token no emite y avisa", () => {
        for (const entorno of [EEntorno.PRODUCCION, EEntorno.TEST]) {
            const d = decidirHeartbeat(entrada({HEARTBEAT: "true"}, {entorno}));
            assert.equal(d.habilitado, false);
            assert.equal(!d.habilitado && d.avisar, true);
        }
    });

    it("el token del Secret se recorta: un salto de línea final no lo cambia, y solo espacios es no tener token", () => {
        const d = decidirHeartbeat(entrada({HEARTBEAT: "true", HEARTBEAT_TOKEN: "hb1.2026-11.secreto\n"}));
        assert.equal(d.habilitado && d.config.token, "hb1.2026-11.secreto");
        assert.equal(decidirHeartbeat(entrada({HEARTBEAT: "true", HEARTBEAT_TOKEN: " \n"})).habilitado, false);
    });

    it("un HEARTBEAT_SOCKET que no es una URL no emite y avisa", () => {
        const d = decidirHeartbeat(entrada({HEARTBEAT: "true", HEARTBEAT_TOKEN: TOKEN, HEARTBEAT_SOCKET: "no es url"}));
        assert.equal(d.habilitado, false);
        assert.equal(!d.habilitado && d.avisar, true);
    });

    it("en producción, un token que no tiene la forma hb1.<id>.<secreto> no emite y avisa, sin nombrar su valor", () => {
        const malos = ["t", "hb2.id.secreto", "hb1.id", "hb1..secreto", "hb1.id.sec.reto", "hb1.id con espacio.x", `hb1.${"a".repeat(33)}.x`, `hb1.id.${"a".repeat(201)}`];
        for (const token of malos) {
            for (const entorno of [EEntorno.PRODUCCION, EEntorno.TEST]) {
                const d = decidirHeartbeat(entrada({HEARTBEAT: "true", HEARTBEAT_TOKEN: token}, {entorno}));
                assert.equal(d.habilitado, false, token);
                assert.equal(!d.habilitado && d.avisar, true, token);
                assert.ok(!d.habilitado && (token.length < 5 || !d.motivo.includes(token)), token);
            }
        }
    });

    it("fuera de producción el formato del token no se exige (el receptor de desarrollo acepta cualquiera)", () => {
        const d = decidirHeartbeat(entrada({HEARTBEAT: "true", HEARTBEAT_SOCKET: "ws://x", HEARTBEAT_TOKEN: "t"}, {entorno: EEntorno.DESARROLLO}));
        assert.ok(d.habilitado);
    });

    it("ENTORNO incoherente con el bundle da un aviso; coherente o ausente, ninguno", () => {
        const base = {HEARTBEAT: "true", HEARTBEAT_TOKEN: TOKEN};
        assert.equal(decidirHeartbeat(entrada({...base, ENTORNO: "desarrollo"})).avisos.length, 1);
        assert.equal(decidirHeartbeat(entrada({...base, ENTORNO: "raro"})).avisos.length, 1);
        assert.equal(decidirHeartbeat(entrada({...base, ENTORNO: "produccion"})).avisos.length, 0);
        assert.equal(decidirHeartbeat(entrada({...base, ENTORNO: ""})).avisos.length, 0);
        assert.equal(decidirHeartbeat(entrada(base)).avisos.length, 0);
    });
});

describe("ENTORNO incoherente solo avisa si el heartbeat está habilitado", () => {
    it("un worker, un lambda o un servicio sin HEARTBEAT=true no dan el aviso", () => {
        const incoherente = {HEARTBEAT: "true", HEARTBEAT_TOKEN: TOKEN, ENTORNO: "desarrollo"};
        assert.equal(decidirHeartbeat(entrada(incoherente, {tipo: "worker"})).avisos.length, 0);
        assert.equal(decidirHeartbeat(entrada(incoherente, {target: "lambda"})).avisos.length, 0);
        assert.equal(decidirHeartbeat(entrada({...incoherente, HEARTBEAT: "false"})).avisos.length, 0);
        assert.equal(decidirHeartbeat(entrada(incoherente)).avisos.length, 1);
    });
});

describe("tokenConFormato", () => {
    it("acepta hb1.<id>.<secreto> con los caracteres del receptor", () => {
        assert.equal(tokenConFormato("hb1.2026-11.abc_DEF-123"), true);
        assert.equal(tokenConFormato("hb1.a.b"), true);
        assert.equal(tokenConFormato(`hb1.${"a".repeat(32)}.${"b".repeat(200)}`), true);
    });

    it("rechaza lo demás, incluido un salto de línea final", () => {
        assert.equal(tokenConFormato("hb1.a.b\n"), false);
        assert.equal(tokenConFormato(""), false);
    });
});

describe("construirUrl", () => {
    it("una base sin ruta recibe la del heartbeat", () => {
        assert.equal(construirUrl("https://status.meteored.com"), "https://status.meteored.com/status/external/heartbeat/");
        assert.equal(construirUrl("ws://proxy:8080/"), "ws://proxy:8080/status/external/heartbeat/");
    });

    it("una URL con ruta se respeta tal cual", () => {
        assert.equal(construirUrl("ws://proxy:8080/otra/ruta/"), "ws://proxy:8080/otra/ruta/");
        assert.equal(construirUrl("https://x.com/a"), "https://x.com/a");
    });
});
