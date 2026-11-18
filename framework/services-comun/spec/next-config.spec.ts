/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 14:36:40 GMT
 * Hash: 63af83a2a5fbe3976ca2c5acb09127f7
 * Versión: 2026.11.16+4-bixus
 * Anterior: 2026.11.16+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * `next.config.js` base: el `buildId` de un proyecto Next es el hash de sus `buildDirs`, y de él depende que el despliegue
 * detecte que un workspace ha cambiado. Si el proyecto tiene `instrumentation.ts` (el emisor del heartbeat de pods), el hash
 * incluye también el emisor; si no, no cambia nada.
 */

interface IConfigBase {
    generateBuildId?: () => Promise<string>;
}

interface IFabrica {
    (buildDirs?: string[]): IConfigBase;
    dirsDeBuild(buildDirs: string[], existe?: (ruta: string) => boolean): string[];
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fabrica = require(path.join(__dirname, "../../../next.config.js")) as IFabrica;

const md5 = (data: string|Buffer): string => createHash("md5").update(data).digest("hex");

const DIRS_PROYECTO = ["./app", "../../@mr/core/network"];

/**
 * Un monorepo de juguete con el proyecto en `services/app` y los directorios del emisor, y se ejecuta con ese proyecto como
 * directorio de trabajo (las rutas de `buildDirs` son relativas a él).
 */
const enMonorepo = async (prueba: (raiz: string) => Promise<void>): Promise<void> => {
    const raiz = mkdtempSync(path.join(os.tmpdir(), "next-config-"));
    const cwd = process.cwd();
    try {
        for (const dir of ["services/app/app", "@mr/core/workload/heartbeat", "@mr/core/network/client", "@mr/core/network/server", "@mr/core/log/modules"]) {
            mkdirSync(path.join(raiz, dir), {recursive: true});
        }
        writeFileSync(path.join(raiz, "services/app/app/page.tsx"), "pagina");
        writeFileSync(path.join(raiz, "@mr/core/workload/heartbeat/emisor.ts"), "emisor v1");
        writeFileSync(path.join(raiz, "@mr/core/network/client/ws.ts"), "cliente");
        writeFileSync(path.join(raiz, "@mr/core/network/server/http.ts"), "servidor");
        writeFileSync(path.join(raiz, "@mr/core/log/modules/log.ts"), "log v1");
        process.chdir(path.join(raiz, "services/app"));
        await prueba(raiz);
    } finally {
        process.chdir(cwd);
        rmSync(raiz, {recursive: true, force: true});
    }
};

const buildId = async (dirs: string[] = DIRS_PROYECTO): Promise<string> => {
    const generar = fabrica(dirs).generateBuildId;
    assert.ok(generar !== undefined);

    return generar();
};

describe("next.config.js: buildDirs con instrumentation.ts", () => {
    it("sin instrumentation.ts los directorios son los del proyecto, tal cual", () => {
        assert.deepEqual(fabrica.dirsDeBuild(DIRS_PROYECTO, () => false), DIRS_PROYECTO);
    });

    it("con instrumentation.ts añade el emisor, sin repetir lo que el proyecto ya cubre", () => {
        const existe = (ruta: string): boolean => ruta === "./instrumentation.ts";
        assert.deepEqual(fabrica.dirsDeBuild(DIRS_PROYECTO, existe), [
            "./app",
            "../../@mr/core/network",
            "./instrumentation.ts",
            "../../@mr/core/workload/heartbeat",
            "../../@mr/core/workload/config",
            "../../@mr/core/workload/engine",
            "../../@mr/core/dev/manifest",
            "../../@mr/core/log/modules",
            "../../framework/services-comun/modules/utiles",
        ], "el proyecto ya cubre ../../@mr/core/network entero");
        assert.deepEqual(fabrica.dirsDeBuild(["./app", "./instrumentation.ts", "../../@mr/core/workload/"], existe), [
            "./app",
            "./instrumentation.ts",
            "../../@mr/core/workload/",
            "../../@mr/core/network/index.ts",
            "../../@mr/core/network/client/websocket",
            "../../@mr/core/network/metadata/websocket",
            "../../@mr/core/network/server/http/config",
            "../../@mr/core/dev/manifest",
            "../../@mr/core/log/modules",
            "../../framework/services-comun/modules/utiles",
        ], "../../@mr/core/workload/ cubre heartbeat, config y engine");
        assert.deepEqual(fabrica.dirsDeBuild(["./app"], (ruta) => ruta === "./instrumentation.mjs").slice(0, 2), ["./app", "./instrumentation.mjs"], "cualquier extensión de la raíz");
    });

    it("comprueba ./instrumentation.ts relativo al directorio de trabajo", () => {
        const preguntadas: string[] = [];
        assert.deepEqual(fabrica.dirsDeBuild(DIRS_PROYECTO, (ruta) => { preguntadas.push(ruta); return false; }), DIRS_PROYECTO);
        assert.deepEqual(preguntadas, ["ts", "js", "tsx", "jsx", "mts", "mjs", "cts", "cjs"].map((ext) => `./instrumentation.${ext}`));
    });

    it("sin instrumentation.ts el buildId es el de siempre (hash de los buildDirs) y no lo mueve el emisor", async () => {
        await enMonorepo(async (raiz) => {
            // app/ contiene un fichero (page.tsx): su hash es md5(md5(contenido)); la carpeta de red, md5(hash(client) + hash(server)).
            const esperado = md5([md5(md5("pagina")), md5([md5(md5("cliente")), md5(md5("servidor"))].join(""))].join(""));
            const antes = await buildId();
            assert.equal(antes, esperado);

            writeFileSync(path.join(raiz, "@mr/core/workload/heartbeat/emisor.ts"), "emisor v2");
            writeFileSync(path.join(raiz, "@mr/core/log/modules/log.ts"), "log v2");
            assert.equal(await buildId(), antes);
        });
    });

    it("con instrumentation.ts el buildId cambia una vez, y a partir de ahí lo mueve un cambio del emisor o de lo que usa", async () => {
        await enMonorepo(async (raiz) => {
            const sin = await buildId();
            writeFileSync(path.join(raiz, "services/app/instrumentation.ts"), "export async function register() {}");
            const con = await buildId();
            assert.notEqual(con, sin);
            assert.equal(await buildId(), con, "estable");

            writeFileSync(path.join(raiz, "@mr/core/workload/heartbeat/emisor.ts"), "emisor v2");
            const emisor = await buildId();
            assert.notEqual(emisor, con);

            writeFileSync(path.join(raiz, "@mr/core/log/modules/log.ts"), "log v2");
            const log = await buildId();
            assert.notEqual(log, emisor);

            writeFileSync(path.join(raiz, "services/app/instrumentation.ts"), "export async function register() { /* otro */ }");
            assert.notEqual(await buildId(), log);
        });
    });

    it("dirsDeBuild no es enumerable: `{...require(\"next.config\")}` no la copia a la configuración de Next", () => {
        assert.equal(typeof fabrica.dirsDeBuild, "function");
        assert.deepEqual(Object.keys({...fabrica}), []);
        assert.equal("dirsDeBuild" in {...fabrica}, false);
    });

    it("un proyecto sin buildDirs sigue sin generateBuildId", () => {
        assert.equal(fabrica().generateBuildId, undefined);
        assert.equal(fabrica([]).generateBuildId, undefined);
    });
});

/**
 * El cierre de imports del emisor (`@mr/core-workload/heartbeat/next`), calculado de verdad: cada fichero que se empaqueta tiene que
 * estar dentro de lo que `dirsDeBuild` mete en el hash. Si el emisor empieza a importar algo de otro sitio y nadie lo añade a la
 * lista, un cambio ahí no movería el `buildId` y no habría imagen nueva.
 */

const RAIZ = path.resolve(__dirname, "../../../../..");
const EMISOR = path.join(RAIZ, "@mr/core/workload/heartbeat/next/index.ts");

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ts = require("typescript") as typeof import("typescript");

const conExtension = (base: string): string|undefined => [`${base}.ts`, path.join(base, "index.ts")].find((ruta) => existsSync(ruta) && statSync(ruta).isFile());

/** Resuelve un import como lo haría el bundler: relativo, `@mr/core-X/sub` (por su mapa `exports`) o `services-comun/...`. */
const resolver = (desde: string, especificador: string): string|undefined => {
    if (especificador.startsWith(".")) {
        return conExtension(path.resolve(path.dirname(desde), especificador));
    }
    if (especificador.startsWith("services-comun/")) {
        return conExtension(path.join(RAIZ, "framework", especificador));
    }
    const paquete = /^@mr\/core-([^/]+)(\/.*)?$/.exec(especificador);
    if (paquete === null) {
        return undefined;
    }
    const dir = path.join(RAIZ, "@mr/core", paquete[1]);
    const sub = paquete[2] === undefined ? "." : `.${paquete[2]}`;
    const manifest = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as {exports?: Record<string, unknown>};
    const destino = manifest.exports?.[sub];
    if (typeof destino === "string") {
        return path.join(dir, destino);
    }

    return conExtension(path.join(dir, sub));
};

const cierreDeImports = (entrada: string): string[] => {
    const vistos = new Set<string>();
    const pendientes = [entrada];
    while (pendientes.length > 0) {
        const fichero = pendientes.pop() as string;
        if (vistos.has(fichero)) {
            continue;
        }
        vistos.add(fichero);
        const {importedFiles} = ts.preProcessFile(readFileSync(fichero, "utf8"), true, true);
        for (const {fileName} of importedFiles) {
            const resuelto = resolver(fichero, fileName);
            if (resuelto !== undefined) {
                pendientes.push(resuelto);
            }
        }
    }

    return [...vistos].sort();
};

const dentro = (fichero: string, dirs: string[]): boolean => dirs.some((dir) => fichero === dir || fichero.startsWith(`${dir}${path.sep}`));

describe("next.config.js: el cierre de imports del emisor", {skip: !existsSync(EMISOR)}, () => {
    const PROYECTO = path.join(RAIZ, "services/proyecto");
    const dirsDe = (dirs: string[]): string[] => dirs.map((dir) => path.resolve(PROYECTO, dir));

    it("cada fichero que importa el emisor, directa o transitivamente, entra en los directorios del hash", () => {
        const cierre = cierreDeImports(EMISOR);
        assert.ok(cierre.length > 30, `el cierre tiene ${cierre.length} ficheros: ¿se resolvieron los imports?`);
        for (const requerido of ["@mr/core/workload/heartbeat/emisor.ts", "@mr/core/network/client/websocket/index.ts", "@mr/core/dev/manifest/index.ts", "framework/services-comun/modules/utiles/log.ts"]) {
            assert.ok(cierre.includes(path.join(RAIZ, requerido)), `falta ${requerido} en el cierre`);
        }
        const dirs = dirsDe(fabrica.dirsDeBuild(["./app"], () => true));
        const fuera = cierre.filter((fichero) => !dentro(fichero, dirs)).map((fichero) => path.relative(RAIZ, fichero));
        assert.deepEqual(fuera, []);
    });

    it("no hashea lo que no se empaqueta del workspace del emisor (README, CHANGELOG, spec, tmp)", () => {
        const dirs = dirsDe(fabrica.dirsDeBuild(["./app"], () => true));
        const workload = path.join(RAIZ, "@mr/core/workload");
        const red = path.join(RAIZ, "@mr/core/network");
        for (const ajeno of ["server/http/server.ts", "client/http/index.ts", "README.md"]) {
            assert.equal(dentro(path.join(red, ajeno), dirs), false, `network/${ajeno}`);
        }
        for (const ajeno of ["README.md", "CHANGELOG.md", "CODEMAP.md", "spec/sonda.spec.ts", "tmp/spec/x.js", "tsconfig.tsbuildinfo"]) {
            assert.equal(dentro(path.join(workload, ajeno), dirs), false, ajeno);
        }
    });

    it("la comprobación detecta un directorio que falta (quitando uno de la lista falla)", () => {
        const cierre = cierreDeImports(EMISOR);
        const completos = dirsDe(fabrica.dirsDeBuild(["./app"], () => true));
        for (const quitar of ["@mr/core/dev/manifest", "framework/services-comun/modules/utiles", "@mr/core/workload/engine", "@mr/core/network/client/websocket", "@mr/core/network/metadata/websocket", "@mr/core/network/server/http/config", "@mr/core/network/index.ts", "@mr/core/log/modules"]) {
            const dirs = completos.filter((dir) => dir !== path.join(RAIZ, quitar));
            assert.ok(cierre.some((fichero) => !dentro(fichero, dirs)), `sin ${quitar} debería haber ficheros fuera`);
        }
    });
});
