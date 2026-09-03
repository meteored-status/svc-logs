/**
 * Editor: Bixus
 * Fecha: Thu, 03 Sep 2026 06:58:23 GMT
 * Hash: 25119a8e469fb7ad976ed7d8cdd781b9
 * Versión: 2026.9.3+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import {readdirSync, existsSync} from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Las pruebas no pueden vivir dentro de `modules/`: los servicios se traen esos módulos por ruta explícita
 * —`../../framework/services-comun/modules/**\/*.ts` en el tsconfig de `status-frontend`—, así que un
 * `.spec.ts` ahí dentro acabaría en la compilación de cada servicio que consuma el workspace.
 *
 * El tsconfig base excluía `**\/*.spec.ts` con esa intención, pero no servía: TypeScript resuelve las rutas
 * relativas heredadas contra el fichero que las declara, así que el patrón apuntaba a
 * `@mr/core/dev/tsconfig/` y no al workspace. Se quitó por eso, y lo que queda para sostener la regla es
 * dónde se colocan los ficheros. Esta prueba es lo que impide que se rompa sin que nadie se entere.
 */

const raizWorkspace = (): string => {
    let dir = __dirname;
    while (!existsSync(path.join(dir, "package.json"))) {
        const padre = path.dirname(dir);
        assert.notEqual(padre, dir, "no se encontró la raíz del workspace");
        dir = padre;
    }
    return dir;
}

const buscarSpecs = (dir: string, encontrados: string[] = []): string[] => {
    for (const entrada of readdirSync(dir, {withFileTypes: true})) {
        const completa = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
            buscarSpecs(completa, encontrados);
        } else if (entrada.name.endsWith(".spec.ts")) {
            encontrados.push(completa);
        }
    }
    return encontrados;
}

describe("estructura", () => {

    it("no hay pruebas dentro de modules/, que se colarían en la compilación de los servicios", () => {
        const modules = path.join(raizWorkspace(), "modules");
        const encontrados = buscarSpecs(modules).map(f => path.relative(raizWorkspace(), f));

        assert.deepEqual(encontrados, [], `mueve estos ficheros a spec/: ${encontrados.join(", ")}`);
    });
});
