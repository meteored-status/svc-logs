/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: aa11b5d7695b599be6794d21271f4f75
 * Versión: 2026.11.20+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {cargaDePod, construirEjecucion, esCargaFinita, horaProgramadaDeJob, leerEntornoCron} from "../heartbeat/carga";

/**
 * La ejecución de un cronjob o un job tal y como la cuenta el pod: la hora programada sale del nombre del Job (lo que Kubernetes
 * pone), así que un error aquí deja las ejecuciones con la hora equivocada sin que nada falle.
 */

/** 2026-11-19T11:10:00Z, la hora programada del Job `cronjob-status-control-29918110` medido en producción. */
const PROGRAMADA = 29918110 * 60_000;
const INICIO = PROGRAMADA + 2_000;
const JOB = "cronjob-status-control-29918110";

describe("cargaDePod / esCargaFinita", () => {
    it("la carga sale del tipo del manifest, y solo cronjob y job son finitas", () => {
        assert.equal(cargaDePod("service"), "service");
        assert.equal(cargaDePod("cronjob"), "cronjob");
        assert.equal(cargaDePod("job"), "job");
        assert.equal(cargaDePod("worker"), "service");
        assert.equal(esCargaFinita("service"), false);
        assert.equal(esCargaFinita("cronjob"), true);
        assert.equal(esCargaFinita("job"), true);
    });
});

describe("horaProgramadaDeJob", () => {
    const base = {job: JOB, cronjob: "cronjob-status-control", inicio: INICIO, plazoInicioS: null, plazoEjecucionS: null};

    it("con CRON_NOMBRE, el número del nombre son los minutos desde epoch de la hora programada", () => {
        assert.equal(horaProgramadaDeJob(base), PROGRAMADA);
        assert.equal(new Date(PROGRAMADA).toISOString(), "2026-11-19T11:10:00.000Z");
    });

    it("sin CRON_NOMBRE, acepta <algo>-<8 a 10 dígitos>", () => {
        assert.equal(horaProgramadaDeJob({...base, cronjob: ""}), PROGRAMADA);
        assert.equal(horaProgramadaDeJob({...base, cronjob: "", job: "otra-cosa-29918110"}), PROGRAMADA);
        assert.equal(horaProgramadaDeJob({...base, cronjob: "", job: "manual-1234567"}), null, "7 dígitos no valen sin cronjob");
    });

    it("con un prefijo distinto del CRON_NOMBRE no hay hora, aunque el número encaje", () => {
        assert.equal(horaProgramadaDeJob({...base, cronjob: "cronjob-otro"}), null);
        assert.equal(horaProgramadaDeJob({...base, cronjob: "status"}), null, "ni como prefijo parcial");
    });

    it("el nombre del CronJob se escapa: un punto no vale por cualquier carácter", () => {
        assert.equal(horaProgramadaDeJob({...base, cronjob: "cronjob.status.control"}), null);
        assert.equal(horaProgramadaDeJob({...base, cronjob: "a.b", job: "a.b-29918110"}), PROGRAMADA);
    });

    it("un Job lanzado a mano con nombre libre no tiene hora", () => {
        assert.equal(horaProgramadaDeJob({...base, job: "cronjob-status-control-manual"}), null);
        assert.equal(horaProgramadaDeJob({...base, job: "cronjob-status-control-29918110-extra"}), null);
        assert.equal(horaProgramadaDeJob({...base, job: "migracion-jose"}), null);
    });

    it("un número que no encaja en el tiempo no es una hora programada", () => {
        assert.equal(horaProgramadaDeJob({...base, inicio: PROGRAMADA - 120_000}), null, "posterior al arranque");
        assert.equal(horaProgramadaDeJob({...base, inicio: PROGRAMADA - 30_000}), PROGRAMADA, "hasta 60 s de desfase de relojes");
        assert.equal(horaProgramadaDeJob({...base, inicio: PROGRAMADA + (3600 + 86400) * 1000 + 1}), null, "más de plazoInicio + plazoEjecucion antes");
    });

    it("un reintento tardío dentro del margen conserva la hora programada, con los plazos por defecto y con los declarados", () => {
        assert.equal(horaProgramadaDeJob({...base, inicio: PROGRAMADA + 3 * 3600 * 1000}), PROGRAMADA);
        assert.equal(horaProgramadaDeJob({...base, inicio: PROGRAMADA + 540_000 + 300_000, plazoInicioS: 300, plazoEjecucionS: 540}), PROGRAMADA);
        assert.equal(horaProgramadaDeJob({...base, inicio: PROGRAMADA + 841_000, plazoInicioS: 300, plazoEjecucionS: 540}), null);
    });
});

describe("leerEntornoCron", () => {
    it("todo puede faltar: el job sale del hostname sin su último trozo y lo demás queda vacío o null", () => {
        const e = leerEntornoCron({}, {hostname: "cronjob-status-control-29918110-8mcpp"});
        assert.deepEqual(e, {job: JOB, jobUid: "", cronjob: "", indice: null, programacion: null, zonaHoraria: null, concurrencia: null, plazoInicioS: null, plazoEjecucionS: null});
    });

    it("lee las variables del kustomize; POD_JOB manda sobre el hostname", () => {
        const e = leerEntornoCron({
            CRON_NOMBRE: "cronjob-status-control", CRON_SCHEDULE: "*/10 * * * *", CRON_TIMEZONE: "Europe/Madrid", CRON_CONCURRENCIA: "Forbid",
            CRON_PLAZO_INICIO_S: "300", CRON_PLAZO_EJECUCION_S: "540", POD_JOB: JOB, POD_JOB_UID: "7c9d5f8b-0000-4000-8000-000000000001",
        }, {hostname: "otro-nombre-abcde"});
        assert.deepEqual(e, {
            job: JOB, jobUid: "7c9d5f8b-0000-4000-8000-000000000001", cronjob: "cronjob-status-control", indice: null, programacion: "*/10 * * * *", zonaHoraria: "Europe/Madrid",
            concurrencia: "Forbid", plazoInicioS: 300, plazoEjecucionS: 540,
        });
    });

    it("enteros solo >= 0 y completos; concurrencia solo del enum", () => {
        for (const malo of ["", "-1", "1.5", "abc", "12s", " ", "1e3"]) {
            const e = leerEntornoCron({CRON_PLAZO_INICIO_S: malo, CRON_PLAZO_EJECUCION_S: malo}, {hostname: "h"});
            assert.equal(e.plazoInicioS, null, malo);
            assert.equal(e.plazoEjecucionS, null, malo);
        }
        assert.equal(leerEntornoCron({CRON_PLAZO_INICIO_S: "0"}, {hostname: "h"}).plazoInicioS, 0);
        for (const c of ["Allow", "Forbid", "Replace"]) {
            assert.equal(leerEntornoCron({CRON_CONCURRENCIA: c}, {hostname: "h"}).concurrencia, c);
        }
        for (const c of ["forbid", "Otra", ""]) {
            assert.equal(leerEntornoCron({CRON_CONCURRENCIA: c}, {hostname: "h"}).concurrencia, null, c);
        }
    });

    it("recorta cada cadena a su máximo del contrato", () => {
        const e = leerEntornoCron({
            POD_JOB: "j".repeat(100), POD_JOB_UID: "u".repeat(100), CRON_NOMBRE: "c".repeat(100), CRON_SCHEDULE: "s".repeat(200), CRON_TIMEZONE: "z".repeat(100),
        }, {hostname: "h"});
        assert.deepEqual([e.job.length, e.jobUid.length, e.cronjob.length, e.programacion?.length, e.zonaHoraria?.length], [63, 36, 63, 100, 64]);
    });

    it("un hostname sin la forma <job>-<5 caracteres> se usa entero, recortado; nunca vacío", () => {
        assert.equal(leerEntornoCron({}, {hostname: "mi-maquina.local"}).job, "mi-maquina.local");
        assert.equal(leerEntornoCron({}, {hostname: "x".repeat(80)}).job.length, 63);
        assert.equal(leerEntornoCron({POD_JOB: "  "}, {hostname: "job-abcde"}).job, "job");
    });
});

describe("JOB_COMPLETION_INDEX (índice de un Job Indexed)", () => {
    const hostname = "cronjob-status-control-29918110-8mcpp";
    const indice = (valor: string|undefined) => leerEntornoCron(valor === undefined ? {} : {JOB_COMPLETION_INDEX: valor}, {hostname}).indice;

    it("un entero decimal de 0 a 65535 es el índice", () => {
        assert.equal(indice("3"), 3);
        assert.equal(indice("0"), 0);
        assert.equal(indice("25"), 25);
        assert.equal(indice("65535"), 65535);
        assert.equal(indice(" 3 "), 3, "con espacios alrededor");
    });

    it("ausente, vacío o cualquier otra cosa es null", () => {
        for (const valor of [undefined, "", "   ", "abc", "-1", "+3", "3.5", "3e2", "0x10", "65536", "70000", "123456", "99999999999999999999"]) {
            assert.equal(indice(valor), null, `${JSON.stringify(valor)}`);
        }
    });

    it("llega a la ejecución del latido, en un cronjob y en un job; sin la variable, null", () => {
        const env = {JOB_COMPLETION_INDEX: "7", POD_JOB: JOB};
        assert.equal(construirEjecucion({env, hostname, carga: "cronjob", inicio: INICIO}).indice, 7);
        assert.equal(construirEjecucion({env, hostname, carga: "job", inicio: INICIO}).indice, 7);
        assert.equal(construirEjecucion({env: {JOB_COMPLETION_INDEX: "-1"}, hostname, carga: "cronjob", inicio: INICIO}).indice, null);
        assert.equal(construirEjecucion({env: {}, hostname, carga: "cronjob", inicio: INICIO}).indice, null);
    });

    it("no cambia cómo se identifica el Job: POD_JOB (o el hostname sin su último trozo) sigue mandando", () => {
        assert.equal(leerEntornoCron({JOB_COMPLETION_INDEX: "3", POD_JOB: JOB}, {hostname: "otro-3-abcde"}).job, JOB);
        assert.equal(leerEntornoCron({JOB_COMPLETION_INDEX: "3"}, {hostname}).job, JOB);
    });

    it("un Job Indexed sin POD_JOB: el hostname `<job>-<índice>` da el Job quitando `-<índice>`, igual para todos los índices", () => {
        for (const indice of [0, 3, 25, 12345]) {
            const e = leerEntornoCron({JOB_COMPLETION_INDEX: String(indice)}, {hostname: `sitemap-regenerator-29918110-${indice}`});
            assert.equal(e.job, "sitemap-regenerator-29918110", `índice ${indice}`);
            assert.equal(e.indice, indice);
        }
    });

    it("un Job Indexed sin POD_JOB ni CRON_NOMBRE: el CronJob sale del Job sin el índice, el mismo para todos los índices", () => {
        const cronjobs = [0, 1, 25].map(indice => construirEjecucion({env: {JOB_COMPLETION_INDEX: String(indice)}, hostname: `sitemap-regenerator-29918110-${indice}`, carga: "cronjob", inicio: INICIO}));
        assert.deepEqual(new Set(cronjobs.map(item => item.cronjob)), new Set(["sitemap-regenerator"]));
        assert.deepEqual(new Set(cronjobs.map(item => item.job)), new Set(["sitemap-regenerator-29918110"]));
    });

    it("con índice pero un hostname que no termina en `-<índice>`, se usa la forma de siempre; y sin índice, el sufijo no se quita aunque lo parezca", () => {
        assert.equal(leerEntornoCron({JOB_COMPLETION_INDEX: "3"}, {hostname: "job-7-abcde"}).job, "job-7");
        assert.equal(leerEntornoCron({JOB_COMPLETION_INDEX: "3"}, {hostname: "-3"}).job, "-3");
        assert.equal(leerEntornoCron({}, {hostname: "sitemap-regenerator-29918110-3"}).job, "sitemap-regenerator-29918110-3");
        assert.equal(leerEntornoCron({JOB_COMPLETION_INDEX: "abc"}, {hostname: "sitemap-3"}).job, "sitemap-3");
    });

    it("POD_JOB sigue mandando también en un Indexed", () => {
        assert.equal(leerEntornoCron({JOB_COMPLETION_INDEX: "3", POD_JOB: JOB}, {hostname: "sitemap-regenerator-29918110-3"}).job, JOB);
    });
});

describe("construirEjecucion", () => {
    const env = {CRON_NOMBRE: "cronjob-status-control", CRON_SCHEDULE: "*/10 * * * *", POD_JOB: JOB, POD_JOB_UID: "uid-1"};
    const hostname = "cronjob-status-control-29918110-8mcpp";

    it("un cronjob lleva la hora programada y resultado y error a null", () => {
        assert.deepEqual(construirEjecucion({env, hostname, carga: "cronjob", inicio: INICIO}), {
            job: JOB, jobUid: "uid-1", cronjob: "cronjob-status-control", indice: null, programada: PROGRAMADA, programacion: "*/10 * * * *", zonaHoraria: null,
            concurrencia: null, plazoInicioS: null, plazoEjecucionS: null, resultado: null, error: null,
        });
    });

    it("un job nunca tiene hora programada, aunque su nombre la parezca, y manda igualmente su CRON_SCHEDULE de relleno", () => {
        const e = construirEjecucion({env: {...env, CRON_SCHEDULE: "0 0 31 2 *"}, hostname, carga: "job", inicio: INICIO});
        assert.equal(e.programada, null);
        assert.equal(e.programacion, "0 0 31 2 *");
    });

    it("sin CRON_NOMBRE el cronjob sale del prefijo del job antes de -<número>, y si no encaja es el propio job (nunca vacío)", () => {
        assert.equal(construirEjecucion({env: {}, hostname, carga: "cronjob", inicio: INICIO}).cronjob, "cronjob-status-control");
        assert.equal(construirEjecucion({env: {}, hostname: "migracion-jose-abcde", carga: "job", inicio: INICIO}).cronjob, "migracion-jose");
        assert.equal(construirEjecucion({env: {}, hostname: "migracion-1234-abcde", carga: "job", inicio: INICIO}).cronjob, "migracion-1234");
    });
});
