import {after, describe, it} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {raizDelMonorepo, workspacesDe} from "../lib/workspaces.js";
import {probador} from "../lib/probador.js";
import regla from "../rules/import-blocks.js";

/**
 * Monorepo de mentira en un temporal, porque las dos funciones miran el disco y la única forma de
 * probarlas es darles uno con la forma que tiene el de verdad: patrones literales y con comodín,
 * workspaces con su propio `package.json` y directorios que no lo son.
 */
const RAIZ = fs.mkdtempSync(path.join(os.tmpdir(), "core-lint-"));

function escribir(ruta, contenido) {
    fs.mkdirSync(path.dirname(path.join(RAIZ, ruta)), {recursive: true});
    fs.writeFileSync(path.join(RAIZ, ruta), typeof contenido === "string" ? contenido : JSON.stringify(contenido));
}

escribir("package.json", {private: true, workspaces: ["@mr/cli", "@mr/core/*", "services/*", "i18n", "no-existe/*", "raro/**"]});
escribir("@mr/cli/package.json", {name: "@mr/cli"});
escribir("@mr/core/dev/package.json", {name: "@mr/core-dev"});
escribir("@mr/core/network/package.json", {name: "@mr/core-network"});
escribir("services/web/package.json", {name: "web"});
escribir("services/web/modules/a/b.ts", "");
// Un directorio cubierto por el comodín pero sin `package.json` no es un workspace.
escribir("services/basura/leeme.txt", "");
// Ni uno con un `package.json` roto: se ignora sin tumbar la pasada.
escribir("services/roto/package.json", "{no es json");
escribir("raro/x/package.json", {name: "no-se-expande"});

after(() => {
    fs.rmSync(RAIZ, {recursive: true, force: true});
});

describe("raizDelMonorepo", () => {
    it("sube hasta el package.json que declara workspaces, no hasta el más cercano", () => {
        assert.equal(raizDelMonorepo(path.join(RAIZ, "services/web/modules/a")), RAIZ);
    });

    it("devuelve undefined fuera de un monorepo", () => {
        assert.equal(raizDelMonorepo(os.tmpdir()), undefined);
    });
});

describe("workspacesDe", () => {
    it("expande rutas literales y comodines finales, y lee el nombre de cada package.json", () => {
        assert.deepEqual(workspacesDe(RAIZ).sort(), ["@mr/cli", "@mr/core-dev", "@mr/core-network", "web"]);
    });

    it("ignora los patrones que no sabe expandir en vez de adivinarlos", () => {
        assert.ok(!workspacesDe(RAIZ).includes("no-se-expande"));
    });
});

/**
 * Sin la opción `workspaces`, `import-blocks` saca la lista del monorepo del fichero. Es lo que
 * permite que la configuración no la lleve escrita, y lo que se rompería sin avisar: una lista vacía
 * no falla, solo manda los imports de otros workspaces al bloque de dependencias públicas.
 */
probador.run("import-blocks deduce los workspaces del monorepo", regla, {
    valid: [
        {
            code: "import fs from \"node:fs\";\n\nimport {Manifest} from \"@mr/core-dev/manifest\";\n\nimport {a} from \"./a\";",
            filename: path.join(RAIZ, "services/web/modules/a/b.ts"),
        },
    ],
    invalid: [
        {
            // Si la lista no se dedujera, los dos serían del bloque público y no habría nada que separar.
            code: "import fs from \"node:fs\";\nimport {Manifest} from \"@mr/core-dev/manifest\";",
            filename: path.join(RAIZ, "services/web/modules/a/b.ts"),
            output: "import fs from \"node:fs\";\n\nimport {Manifest} from \"@mr/core-dev/manifest\";",
            errors: [{messageId: "faltaSeparacion"}],
        },
    ],
});
