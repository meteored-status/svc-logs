/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:11 GMT
 * Hash: a46b4c057a4bfb94d1be7d7428dd83df
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import {after, before, describe, it} from "node:test";
import assert from "node:assert/strict";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {comprobarRouteGroup, crearPrograma} from "../../src/clases/auto-doc/programa";
import {IMPORT_RG, programaDe} from "./programa-virtual";

describe("crearPrograma", () => {
    let dir: string;

    before(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), "autodoc-spec-"));
    });

    after(async () => {
        await rm(dir, {recursive: true, force: true});
    });

    async function servicio(nombre: string, tsconfig: string, conRouteGroup: boolean): Promise<{tsconfig: string, main: string}> {
        const raiz = path.join(dir, nombre);
        await mkdir(path.join(raiz, "server/http/routes/group"), {recursive: true});
        await writeFile(path.join(raiz, "tsconfig.json"), tsconfig);
        await writeFile(path.join(raiz, "server/http/routes/group/index.ts"), "export const grupo = 1;\n");
        await writeFile(path.join(raiz, "main.ts"), conRouteGroup ? `import "./server/http/routes/group/index";\n` : "export const x = 1;\n");

        return {tsconfig: path.join(raiz, "tsconfig.json"), main: path.join(raiz, "main.ts")};
    }

    it("crea el programa de un tsconfig correcto", async () => {
        const {tsconfig, main} = await servicio("ok", `{"compilerOptions": {"strict": true, "types": []}}`, true);
        const programa = crearPrograma(tsconfig, main);
        assert.ok(programa.getSourceFile(main));
    });

    it("un extends que no resuelve es un error, no un programa con opciones por defecto", async () => {
        const {tsconfig, main} = await servicio("extends-roto", `{"extends": "./no-existe.json", "compilerOptions": {"strict": true}}`, true);
        assert.throws(() => crearPrograma(tsconfig, main), /No se puede leer .*extends-roto\/tsconfig\.json: .*no-existe/);
    });

    it("un programa sin el fichero de RouteGroup es un error", async () => {
        const {tsconfig, main} = await servicio("sin-grupo", `{"compilerOptions": {"strict": true, "types": []}}`, false);
        assert.throws(() => crearPrograma(tsconfig, main), /no incluye \/server\/http\/routes\/group\/index\.ts/);
    });
});

describe("comprobarRouteGroup", () => {
    it("pasa con el stub de RouteGroup en el programa y falla sin él", () => {
        assert.doesNotThrow(() => comprobarRouteGroup(programaDe(`${IMPORT_RG}export class A extends RouteGroup { protected getHandlers(): IRouteGroup[] { return []; } }`), "tsconfig.json"));
        assert.throws(() => comprobarRouteGroup(programaDe("export const x = 1;", {}), "tsconfig.json"), /no incluye/);
    });
});
