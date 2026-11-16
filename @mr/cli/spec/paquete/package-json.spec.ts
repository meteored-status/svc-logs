/**
 * Editor: Bixus
 * Fecha: Mon, 09 Nov 2026 08:26:05 GMT
 * Hash: 07c6ef5ba57798120cc62058d946f5b3
 * Versión: 2026.11.9+6-bixus
 * Anterior: 2026.11.9+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {packageJsonTrasUpdate} from "../../src/clases/paquete/package-json";

/**
 * Un `package.json` de framework.
 *
 * @param version - Valor de `version`.
 * @param scripts - Scripts.
 * @param ddTrace - Rango de `dd-trace`.
 * @returns El JSON formateado como lo escribe el update.
 */
function paquete(version: string, scripts: Record<string, string>, ddTrace: string): string {
    return `${JSON.stringify({name: "@mr/cli", scripts, dependencies: {"dd-trace": ddTrace}, version}, null, 2)}\n`;
}

const REMOTO = paquete("2026.11.9+1-davidmartinezmoya", {compile: "c"}, "^6.24.0");

/**
 * Lo que hace `preMezcla()` en `file.ts` antes del diff3: las claves de la raíz con prioridad delante y
 * todas las demás, a todos los niveles, en orden alfabético.
 *
 * @param texto - `package.json`.
 * @returns El mismo JSON con las claves reordenadas.
 */
function comoLoDejaLaMezcla(texto: string): string {
    const prioridad = ["name", "description", "author", "scripts", "bin", "config"];
    const ordenar = (valor: unknown, raiz: boolean): unknown => {
        if (Array.isArray(valor)) {
            return valor.map((item) => ordenar(item, false));
        }
        if (typeof valor!=="object" || valor===null) {
            return valor;
        }
        const entrada = valor as Record<string, unknown>;
        const claves = raiz ? prioridad.filter((k) => k in entrada) : [];
        claves.push(...Object.keys(entrada).sort().filter((k) => !claves.includes(k)));
        return Object.fromEntries(claves.map((k) => [k, ordenar(entrada[k], false)]));
    };
    return `${JSON.stringify(ordenar(JSON.parse(texto), true), null, 2)}\n`;
}

// Como el de @mr/core-dev: condiciones de `exports` cuyo orden decide, y claves fuera del alfabeto.
const REMOTO_EXPORTS = `${JSON.stringify({
    name: "@mr/core-dev",
    version: "2026.11.9+1-bixus",
    scripts: {test: "t", build: "b"},
    exports: {
        "./tsconfig.json": {browser: "./tsconfig/browser.json", node: "./tsconfig/node.json", default: "./tsconfig.json"},
        "./paquete": {types: "./index.d.ts", require: "./index.cjs", import: "./index.mjs", default: "./index.js"},
    },
    devDependencies: {typescript: "^6.0.3", esbuild: "^0.28.2"},
}, null, 2)}\n`;

describe("packageJsonTrasUpdate", () => {
    it("conserva lo que la mezcla trae de local (el caso del script `test` perdido) y toma la versión remota", () => {
        // Lo que deja la mezcla a tres bandas: el script local y la dependencia remota.
        const mezcla = paquete("2026.11.2+6-bixus", {compile: "c", test: "t"}, "^6.24.0");
        const resultado = JSON.parse(packageJsonTrasUpdate(mezcla, REMOTO)) as {scripts: Record<string, string>; version: string; dependencies: Record<string, string>};

        assert.equal(resultado.scripts["test"], "t");
        assert.equal(resultado.dependencies["dd-trace"], "^6.24.0");
        assert.equal(resultado.version, "2026.11.9+1-davidmartinezmoya");
    });

    it("sin cambios locales queda idéntico al remoto", () => {
        assert.equal(packageJsonTrasUpdate(REMOTO, REMOTO), REMOTO);
    });

    it("devuelve el orden del remoto a lo que la mezcla ha ordenado alfabéticamente (`default` tras `node`)", () => {
        assert.equal(packageJsonTrasUpdate(comoLoDejaLaMezcla(REMOTO_EXPORTS), REMOTO_EXPORTS), REMOTO_EXPORTS);
    });

    it("lo que solo está en local va detrás, pero `default` sigue siendo la última condición", () => {
        const local = JSON.parse(comoLoDejaLaMezcla(REMOTO_EXPORTS)) as {scripts: Record<string, string>; exports: Record<string, Record<string, string>>};
        local.scripts["lint"] = "l";
        local.exports["./tsconfig.json"]["deno"] = "./tsconfig/deno.json";
        const resultado = JSON.parse(packageJsonTrasUpdate(JSON.stringify(local), REMOTO_EXPORTS)) as typeof local;

        assert.deepEqual(Object.keys(resultado.scripts), ["test", "build", "lint"]);
        assert.deepEqual(Object.keys(resultado.exports["./tsconfig.json"]), ["browser", "node", "deno", "default"]);
        assert.deepEqual(Object.keys(resultado.exports["./paquete"]), ["types", "require", "import", "default"]);
    });

    it("con marcas de conflicto, o sin fichero, se queda el remoto", () => {
        const conflicto = `{\n<<<<<<< local\n  "version": "a"\n=======\n  "version": "b"\n>>>>>>> remoto\n}\n`;
        assert.equal(packageJsonTrasUpdate(conflicto, REMOTO), REMOTO);
        assert.equal(packageJsonTrasUpdate(undefined, REMOTO), REMOTO);
        assert.equal(packageJsonTrasUpdate("[]", REMOTO), REMOTO);
    });
});
