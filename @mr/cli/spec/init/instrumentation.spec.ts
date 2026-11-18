/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 14:36:40 GMT
 * Hash: a1aea54607c41d013603e623ff8d5750
 * Versión: 2026.11.16+8-bixus
 * Anterior: 2026.11.16+7-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {CANDIDATOS_INSTRUMENTATION, CONTENIDO_INSTRUMENTATION, MARCA_INSTRUMENTATION, RUTA_EMISOR_INSTRUMENTATION, RUTA_INSTRUMENTATION, aplicaInstrumentation, comprobarInstrumentation, decidirInstrumentation, dependenciasInstrumentation, planificarInstrumentation, type IDiscoInstrumentation} from "../../src/clases/init/instrumentation";

/**
 * `mrpack init` en un workspace Next.js: genera `instrumentation.ts` (el arranque del heartbeat de pods) sin pisar el de otro, y deja
 * `@mr/core-workload` en sus `devDependencies`.
 */

/** Un disco real: una carpeta temporal por prueba. */
const conWorkspace = async (prueba: (dir: string, disco: IDiscoInstrumentation) => Promise<void>): Promise<void> => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "init-instrumentation-"));
    const disco: IDiscoInstrumentation = {
        leer: async (ruta) => fs.existsSync(path.join(dir, ruta)) ? fs.readFileSync(path.join(dir, ruta), "utf8") : null,
        escribir: async (ruta, contenido) => {
            fs.mkdirSync(path.dirname(path.join(dir, ruta)), {recursive: true});
            fs.writeFileSync(path.join(dir, ruta), contenido, {flag: "wx"});
        },
    };
    try {
        await prueba(dir, disco);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
};

describe("CONTENIDO_INSTRUMENTATION", () => {
    it("es el register() que arranca el heartbeat solo en el runtime de Node", () => {
        assert.equal(CONTENIDO_INSTRUMENTATION, [
            "export async function register(): Promise<void> {",
            "    if (process.env[\"NEXT_RUNTIME\"] === \"nodejs\") {",
            "        (await import(\"@mr/core-workload/heartbeat/next\")).iniciarHeartbeatNext();",
            "    }",
            "}",
            "",
        ].join("\n"));
        assert.ok(CONTENIDO_INSTRUMENTATION.includes(MARCA_INSTRUMENTATION));
    });

    it("los candidatos son instrumentation.* en la raíz y en src/, con la raíz y .ts primero", () => {
        assert.equal(CANDIDATOS_INSTRUMENTATION[0], RUTA_INSTRUMENTATION);
        assert.ok(CANDIDATOS_INSTRUMENTATION.includes("instrumentation.js"));
        assert.ok(CANDIDATOS_INSTRUMENTATION.includes("src/instrumentation.ts"));
        assert.ok(!CANDIDATOS_INSTRUMENTATION.includes("instrumentation.d.ts"));
    });
});

describe("aplicaInstrumentation", () => {
    it("solo los workspaces de Node con framework Next.js", () => {
        assert.equal(aplicaInstrumentation({framework: "nextjs", runtime: "node"}), true);
        assert.equal(aplicaInstrumentation({framework: "meteored", runtime: "node"}), false);
        assert.equal(aplicaInstrumentation({framework: "nextjs", runtime: "cfworker"}), false);
        assert.equal(aplicaInstrumentation({framework: "meteored", runtime: "browser"}), false);
    });
});

describe("decidirInstrumentation", () => {
    it("sin ningún instrumentation.* se crea", () => {
        assert.deepEqual(decidirInstrumentation([]), {crear: true, avisos: []});
    });

    it("uno que ya arranca el heartbeat, en la raíz o en src/, se deja", () => {
        assert.deepEqual(decidirInstrumentation([{ruta: "instrumentation.ts", contenido: CONTENIDO_INSTRUMENTATION}]), {crear: false, avisos: []});
        assert.deepEqual(decidirInstrumentation([{ruta: "instrumentation.mjs", contenido: "iniciarHeartbeatNext()"}]), {crear: false, avisos: []});
    });

    it("uno válido que solo está en src/ se deja, pero se avisa: el buildId solo vigila la raíz", () => {
        const {crear, avisos} = decidirInstrumentation([{ruta: "src/instrumentation.js", contenido: "iniciarHeartbeatNext()"}]);
        assert.equal(crear, false);
        assert.equal(avisos.length, 1);
        assert.match(avisos[0], /^src\/instrumentation\.js arranca el heartbeat.*raíz/);
        assert.deepEqual(decidirInstrumentation([
            {ruta: "src/instrumentation.js", contenido: "iniciarHeartbeatNext()"},
            {ruta: "instrumentation.ts", contenido: CONTENIDO_INSTRUMENTATION},
        ]), {crear: false, avisos: []});
    });

    it("uno ajeno no se pisa: se avisa, con su ruta y lo que hay que añadir", () => {
        const {crear, avisos} = decidirInstrumentation([{ruta: "instrumentation.js", contenido: "export function register() { iniciarSentry(); }"}]);
        assert.equal(crear, false);
        assert.equal(avisos.length, 1);
        assert.match(avisos[0], /^instrumentation\.js ya existe y no llama a iniciarHeartbeatNext\(\)/);
        assert.match(avisos[0], /@mr\/core-workload\/heartbeat\/next/);
    });

    it("si hay uno ajeno y otro que sí lo arranca, no hay nada que hacer ni que avisar", () => {
        const {crear, avisos} = decidirInstrumentation([
            {ruta: "src/instrumentation.ts", contenido: "export function register() {}"},
            {ruta: "instrumentation.ts", contenido: CONTENIDO_INSTRUMENTATION},
        ]);
        assert.equal(crear, false);
        assert.deepEqual(avisos, []);
    });
});

describe("comprobarInstrumentation (con un disco real)", () => {
    it("crea instrumentation.ts con el contenido de siempre", async () => {
        await conWorkspace(async (dir, disco) => {
            const decision = await comprobarInstrumentation(disco);
            assert.equal(decision.crear, true);
            assert.equal(fs.readFileSync(path.join(dir, "instrumentation.ts"), "utf8"), CONTENIDO_INSTRUMENTATION);
        });
    });

    it("es idempotente: la segunda vez no cambia nada, ni el contenido ni la fecha", async () => {
        await conWorkspace(async (dir, disco) => {
            await comprobarInstrumentation(disco);
            const antes = fs.statSync(path.join(dir, "instrumentation.ts")).mtimeMs;
            await new Promise<void>((resolve) => { setTimeout(resolve, 15); });
            const decision = await comprobarInstrumentation(disco);
            assert.deepEqual(decision, {crear: false, avisos: []});
            assert.equal(fs.statSync(path.join(dir, "instrumentation.ts")).mtimeMs, antes);
            assert.equal(fs.readFileSync(path.join(dir, "instrumentation.ts"), "utf8"), CONTENIDO_INSTRUMENTATION);
        });
    });

    it("no pisa un instrumentation.ts ajeno y avisa", async () => {
        await conWorkspace(async (dir, disco) => {
            const ajeno = "export async function register() { await import(\"./sentry\"); }\n";
            fs.writeFileSync(path.join(dir, "instrumentation.ts"), ajeno);
            const decision = await comprobarInstrumentation(disco);
            assert.equal(decision.crear, false);
            assert.equal(decision.avisos.length, 1);
            assert.equal(fs.readFileSync(path.join(dir, "instrumentation.ts"), "utf8"), ajeno);
        });
    });

    it("tampoco crea uno nuevo si ya hay uno ajeno en otra extensión o en src/", async () => {
        await conWorkspace(async (dir, disco) => {
            fs.mkdirSync(path.join(dir, "src"));
            fs.writeFileSync(path.join(dir, "src/instrumentation.ts"), "export function register() {}\n");
            fs.writeFileSync(path.join(dir, "instrumentation.mjs"), "export function register() {}\n");
            const decision = await comprobarInstrumentation(disco);
            assert.equal(decision.crear, false);
            assert.equal(decision.avisos.length, 2);
            assert.equal(fs.existsSync(path.join(dir, "instrumentation.ts")), false);
        });
    });
});

describe("dependenciasInstrumentation", () => {
    it("añade @mr/core-workload como workspace:*", () => {
        const dev: Record<string, string> = {"@mr/core-dev": "workspace:*", typescript: "^6.0.3"};
        dependenciasInstrumentation(dev);
        assert.deepEqual(dev, {"@mr/core-dev": "workspace:*", typescript: "^6.0.3", "@mr/core-workload": "workspace:*"});
    });

    it("es idempotente y no cambia una entrada que ya está", () => {
        const dev: Record<string, string> = {"@mr/core-workload": "workspace:^"};
        dependenciasInstrumentation(dev);
        dependenciasInstrumentation(dev);
        assert.deepEqual(dev, {"@mr/core-workload": "workspace:^"});
    });
});

describe("planificarInstrumentation", () => {
    const base = {framework: "nextjs", runtime: "node", enabled: true, emisorDisponible: true};

    it("un Next.js de Node habilitado, con el emisor en el monorepo, se aplica sin avisos", () => {
        assert.deepEqual(planificarInstrumentation(base), {aplicar: true, aviso: null});
    });

    it("sin el emisor en el monorepo no se genera nada ni se añade la dependencia, y se avisa de actualizar", () => {
        const {aplicar, aviso} = planificarInstrumentation({...base, emisorDisponible: false});
        assert.equal(aplicar, false);
        assert.ok(aviso !== null);
        assert.ok(aviso.includes(RUTA_EMISOR_INSTRUMENTATION));
        assert.match(aviso, /mrpack update/);
    });

    it("lo que no es un Next.js de Node habilitado no se toca y no avisa, haya o no emisor", () => {
        for (const emisorDisponible of [true, false]) {
            for (const otro of [{framework: "meteored"}, {runtime: "cfworker"}, {enabled: false}]) {
                assert.deepEqual(planificarInstrumentation({...base, ...otro, emisorDisponible}), {aplicar: false, aviso: null});
            }
        }
    });
});
