import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {parsearLinea, type TParseo} from "../modules/data/source/cloudflare-schema";

/**
 * Eventos reales de producción, sacados de los `Cloudflare.parse` de `service-workers-slave` en
 * Cloud Logging (proyecto `meteored-status`, noviembre de 2026). Los `Logs` largos se han recortado.
 */
const ALARM_CANCELED = `{"Entrypoint":"RateLimiter","Event":{"ScheduledTimeMs":1795004106708},"EventTimestampMs":1795004107117,"EventType":"alarm","Exceptions":[],"Logs":[],"Outcome":"canceled","ScriptName":"widget-rate-limiter","ScriptTags":["cf:service=widget-rate-limiter","cf:environment=prod"],"ScriptVersion":{"ID":"f01ac05b-b257-46eb-ae73-ef344acbff12","Message":"","Tag":""},"DispatchNamespace":""}`;
const ALARM_EXCEPTION = `{"Entrypoint":"RateLimiter","Event":{"ScheduledTimeMs":1795002950350},"EventTimestampMs":1795002950351,"EventType":"alarm","Exceptions":[{"Name":"Error","Message":"Connection closed: this Durable Object instance is no longer active. Reconnect or retry the request.","TimestampMs":1795002950397}],"Logs":[{"Level":"log","Message":["Stats flushed correctly"],"TimestampMs":1795002950397}],"Outcome":"exception","ScriptName":"widget-rate-limiter","ScriptTags":["cf:service=widget-rate-limiter","cf:environment=prod"],"ScriptVersion":{"ID":"f01ac05b-b257-46eb-ae73-ef344acbff12","Message":"","Tag":""},"DispatchNamespace":""}`;
const FETCH_UNKNOWN = `{"Entrypoint":"","Event":{"RayID":"a5c6df6f1e1b8ba7","Request":{"URL":"https://www.meteored.com.bo/sharepic/17636.jpg","Method":"GET"},"Response":{"Status":200}},"EventTimestampMs":1795003834747,"EventType":"fetch","Exceptions":[],"Logs":[],"Outcome":"unknown","ScriptName":"meteored-web-bo","ScriptTags":["cf:service=meteored-web","cf:environment=bo"],"ScriptVersion":{"ID":"f1550850-f9b4-4928-a930-4e0ccb337595","Message":"","Tag":""},"DispatchNamespace":""}`;

/** El mismo evento real con otros valores, para los casos que no se han visto en producción. */
function variar(base: string, cambios: Record<string, unknown>): string {
    return JSON.stringify({...JSON.parse(base), ...cambios});
}

function registro(parseo: TParseo) {
    if (!parseo.ok) {
        assert.fail(`se esperaba un registro y se descartó: ${parseo.motivo}`);
    }
    return parseo.registro;
}

function motivo(parseo: TParseo): string {
    if (parseo.ok) {
        assert.fail("se esperaba un descarte y se parseó");
    }
    return parseo.motivo;
}

describe("parsearLinea — eventos alarm", () => {
    it("acepta una alarma cancelada de un Durable Object", () => {
        const r = registro(parsearLinea(ALARM_CANCELED));
        assert.deepEqual(r.event, {type: "alarm", scheduledTime: new Date(1795004106708)});
        assert.equal(r.status, "canceled");
        assert.equal(r.entrypoint, "RateLimiter");
        assert.equal(r.script, "widget-rate-limiter");
        assert.deepEqual(r["@timestamp"], new Date(1795004107117));
        assert.equal(r.exceptions, undefined);
        assert.equal(r.logs, undefined);
        assert.equal(r.namespace, undefined);
    });

    it("conserva excepciones y logs de una alarma que falla", () => {
        const r = registro(parsearLinea(ALARM_EXCEPTION));
        assert.equal(r.status, "exception");
        assert.equal(r.exceptions?.length, 1);
        assert.equal(r.exceptions?.[0]?.name, "Error");
        assert.deepEqual(r.logs, [`{"Level":"log","Message":["Stats flushed correctly"],"TimestampMs":1795002950397}`]);
    });

    it("no le pone campos de petición", () => {
        const r = registro(parsearLinea(ALARM_CANCELED));
        assert.equal(r.event.rayID, undefined);
        assert.equal(r.event.request, undefined);
        assert.equal(r.event.response, undefined);
    });

    it("descarta una alarma con campos de Event que no conoce, nombrándolos", () => {
        const linea = variar(ALARM_CANCELED, {Event: {ScheduledTimeMs: 1795004106708, Retry: 1}});
        assert.equal(motivo(parsearLinea(linea)), "Event: claves no reconocidas Retry");
    });
});

describe("parsearLinea — eventos fetch", () => {
    it("acepta Outcome unknown", () => {
        const r = registro(parsearLinea(FETCH_UNKNOWN));
        assert.equal(r.status, "unknown");
        assert.deepEqual(r.event, {
            type: "fetch",
            rayID: "a5c6df6f1e1b8ba7",
            request: {url: "https://www.meteored.com.bo/sharepic/17636.jpg", method: "GET"},
            response: {status: 200},
        });
        assert.equal(r.entrypoint, undefined);
    });

    it("acepta los Outcome que documenta la Tail API", () => {
        for (const outcome of ["ok", "exceededCpu", "exceededMemory", "scriptNotFound", "responseStreamDisconnected"]) {
            assert.equal(registro(parsearLinea(variar(FETCH_UNKNOWN, {Outcome: outcome}))).status, outcome);
        }
    });

    it("sigue exigiendo RayID, Request y Response", () => {
        const linea = variar(FETCH_UNKNOWN, {Event: {ScheduledTimeMs: 1}});
        assert.equal(motivo(parsearLinea(linea)), "Event.RayID: invalid_type; Event.Request: invalid_type; Event.Response: invalid_type; Event: claves no reconocidas ScheduledTimeMs");
    });
});

describe("parsearLinea — otros tipos documentados", () => {
    it("guarda el Event de un tipo sin forma conocida como texto", () => {
        const r = registro(parsearLinea(variar(ALARM_CANCELED, {EventType: "scheduled", Event: {Cron: "*/5 * * * *", ScheduledTimeMs: 1}})));
        assert.deepEqual(r.event, {type: "scheduled", detail: `{"Cron":"*/5 * * * *","ScheduledTimeMs":1}`});
    });

    it("acepta Event vacío o null sin detalle", () => {
        assert.deepEqual(registro(parsearLinea(variar(ALARM_CANCELED, {EventType: "queue", Event: {}}))).event, {type: "queue", detail: undefined});
        assert.deepEqual(registro(parsearLinea(variar(ALARM_CANCELED, {EventType: "email", Event: null}))).event, {type: "email", detail: undefined});
    });

    it("acepta todos los EventType documentados", () => {
        for (const tipo of ["scheduled", "queue", "email", "worker_rpc", "hibernatable_web_socket", "tail"]) {
            assert.equal(registro(parsearLinea(variar(ALARM_CANCELED, {EventType: tipo, Event: {}}))).event.type, tipo);
        }
    });
});

describe("parsearLinea — motivos de descarte", () => {
    it("un EventType nuevo da un motivo corto con el valor, no el evento", () => {
        assert.equal(motivo(parsearLinea(variar(ALARM_CANCELED, {EventType: "cron_v2"}))), `EventType="cron_v2"`);
    });

    it("un Outcome nuevo da un motivo corto con el valor", () => {
        assert.equal(motivo(parsearLinea(variar(FETCH_UNKNOWN, {Outcome: "exceededWallTime"}))), `Outcome="exceededWallTime"`);
    });

    it("un campo nuevo en la raíz se nombra", () => {
        assert.equal(motivo(parsearLinea(variar(FETCH_UNKNOWN, {CPUTimeMs: 3}))), "(raíz): claves no reconocidas CPUTimeMs");
    });

    it("una línea que no es JSON no lanza", () => {
        assert.equal(motivo(parsearLinea("{\"EventType\":")), "JSON inválido");
    });

    it("dos líneas con el mismo problema dan el mismo motivo", () => {
        const a = motivo(parsearLinea(variar(ALARM_CANCELED, {EventType: "nuevo", ScriptName: "a"})));
        const b = motivo(parsearLinea(variar(FETCH_UNKNOWN, {EventType: "nuevo", ScriptName: "b"})));
        assert.equal(a, b);
    });
});
