/**
 * Evalúa los `mrpack.pubsub.ts` de unos workspaces y escribe en stdout sus declaraciones como JSON.
 *
 * Uso (desde la raíz del monorepo; `<raiz>` tiene que ser absoluta porque `yarn workspace` cambia el directorio):
 *
 *     yarn workspace @mr/core-dev node pubsub/evaluar.mjs <raiz> <workspace-relativo>...
 *
 * Cada declaración se empaqueta con esbuild —`bundle`, `platform: "node"`, `format: "cjs"`, sin `external`— con los
 * mismos `define` que el build de desarrollo (`DESARROLLO=true`, `PRODUCCION=false`, `DATABASE` con el
 * `build.database.test` del `mrpack.json` del workspace…), de modo que un `DESARROLLO ? a : b` se resuelve igual que
 * en el código. Todo queda dentro del bundle salvo los módulos de Node, y
 * se ejecuta en este proceso. Por eso cada `mrpack.pubsub.ts` solo debe importar módulos de constantes, sin efectos
 * secundarios, y el workspace tiene que declarar `@mr/core-dev` en sus `devDependencies` para importar `definirPubSub`.
 *
 * Salida: `{"declaraciones": [{"workspace": "services/amateur", "declaracion": {...}}]}`, en el orden recibido.
 * Si alguna declaración no compila o lanza al evaluarse, no se escribe nada en stdout: cada fallo va a stderr como
 * `<workspace>: <mensaje>` (una línea por fallo) y el proceso sale con código 1.
 *
 * stdout queda reservado para el JSON: mientras se evalúan las declaraciones, `console.log`, `console.info` y
 * `console.debug` escriben en stderr.
 */
import {build} from "esbuild";
import {existsSync, readFileSync} from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";

import {getDefine} from "../bundler/esbuild/define.mjs";

const FICHERO = "mrpack.pubsub.ts";

const RESOLUCION_CORE_DEV = /Could not resolve "@mr\/core-dev\//;
const PISTA_CORE_DEV = "el workspace necesita `@mr/core-dev` en `devDependencies` (y `yarn install`) para importar `definirPubSub`";

function textoDe(fallo) {
    const lugar = fallo.location ? ` (${fallo.location.file}:${fallo.location.line}:${fallo.location.column})` : "";
    const sinResolver = RESOLUCION_CORE_DEV.test(fallo.text);
    // Para un `@mr/core-dev/...` sin resolver, la nota de esbuild («márcalo como external») despista: lo que falta es la dependencia.
    const notas = (fallo.notes ?? []).map((nota) => nota.text).filter((texto) => texto && !(sinResolver && /as external/.test(texto)));
    return [`${fallo.text}${lugar}`, ...notas, ...(sinResolver ? [PISTA_CORE_DEV] : [])].join(" — ");
}

function mensajeDe(err) {
    if (Array.isArray(err?.errors) && err.errors.length > 0) {
        return err.errors.map(textoDe).join("; ");
    }
    return err instanceof Error ? err.message : String(err);
}

/**
 * Base de datos con la que compila el build de desarrollo: `build.database.test` del `mrpack.json` del workspace
 * (`bundler/esbuild/esbuild.config.mjs`). Sin `mrpack.json` legible o sin ese campo, la que usa el build: ninguna.
 */
function databaseDe(directorio) {
    try {
        return JSON.parse(readFileSync(path.join(directorio, "mrpack.json"), "utf-8")).build?.database?.test;
    } catch {
        return undefined;
    }
}

async function evaluar(raiz, workspace) {
    const directorio = path.resolve(raiz, workspace);
    const entrada = path.join(directorio, FICHERO);
    if (!existsSync(entrada)) {
        throw new Error(`no existe ${FICHERO}`);
    }
    const tsconfig = path.join(directorio, "tsconfig.json");
    const resultado = await build({
        absWorkingDir: directorio,
        entryPoints: [entrada],
        bundle: true,
        platform: "node",
        format: "cjs",
        target: "node24",
        write: false,
        logLevel: "silent",
        ...(existsSync(tsconfig) ? {tsconfig} : {}),
        define: getDefine({entorno: "desarrollo", database: databaseDe(directorio)}),
    });
    const codigo = resultado.outputFiles[0].text;

    const modulo = {exports: {}};
    const ejecutar = new Function("module", "exports", "require", "__filename", "__dirname", codigo);
    ejecutar(modulo, modulo.exports, createRequire(entrada), entrada, directorio);

    const declaracion = modulo.exports?.default ?? modulo.exports;
    if (typeof declaracion !== "object" || declaracion === null) {
        throw new Error(`${FICHERO} no exporta una declaración (se esperaba \`export default definirPubSub({...})\`)`);
    }
    return declaracion;
}

async function main() {
    const [raiz, ...workspaces] = process.argv.slice(2);
    if (raiz === undefined || workspaces.length === 0) {
        process.stderr.write("Uso: node pubsub/evaluar.mjs <raiz> <workspace-relativo>...\n");
        process.exit(2);
    }

    const salida = process.stdout.write.bind(process.stdout);
    console.log = console.info = console.debug = console.error;

    const declaraciones = [];
    const fallos = [];
    for (const workspace of workspaces) {
        try {
            declaraciones.push({workspace, declaracion: await evaluar(raiz, workspace)});
        } catch (err) {
            fallos.push(`${workspace}: ${mensajeDe(err)}`);
        }
    }

    if (fallos.length > 0) {
        process.stderr.write(`${fallos.join("\n")}\n`, () => process.exit(1));
        return;
    }
    salida(`${JSON.stringify({declaraciones})}\n`, () => process.exit(0));
}

main().catch((err) => {
    process.stderr.write(`${mensajeDe(err)}\n`, () => process.exit(1));
});
