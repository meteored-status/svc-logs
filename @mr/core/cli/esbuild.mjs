/**
 * Compilación compartida de las herramientas de línea de comandos del monorepo.
 *
 * Es **JavaScript plano y ESM a propósito**, como `arranque.js`: lo ejecuta `node` directamente
 * desde el `compile` de cada CLI, sin pasar por ningún bundler.
 *
 * Cada CLI se queda con un `src/esbuild.config.mjs` de tres líneas que llama aquí con su entry.
 * Lo que sí es de cada una —externals, tsconfig, punto de entrada— sale de su propio
 * `package.json` y de su propio directorio, no de aquí.
 */
import {build, context} from "esbuild";
import {rmSync, readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, resolve} from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";

/**
 * Externals que no son `dependencies` y aun así no se bundlean.
 *
 * Solo `typescript`: es devDep de build, 9 MB de fuente y con dynamic requires internos que
 * esbuild no puede resolver. Aquí hubo también `ts-checker-rspack-plugin`, que se fue con el
 * fallback de rspack de `@mr/cli` — ninguna de las dos CLI lo declara ya.
 */
const EXTRA_EXTERNAL = ["typescript"];

/** Equivalente al DefinePlugin de rspack: las variables globales del entorno, inlinadas. */
const DEFINE = {
    "DESARROLLO":         "false",
    "TEST":               "false",
    "PRODUCCION":         "true",
    "ENTORNO":            '"produccion"',
    "NEXTJS":             "false",
    "DATABASE":           '"undefined"',
    "global.DESARROLLO":  "false",
    "global.TEST":        "false",
    "global.PRODUCCION":  "true",
    "global.ENTORNO":     '"produccion"',
    "global.NEXTJS":      "false",
    "global.DATABASE":    '"undefined"',
};

/**
 * Lanza `tsc --noEmit` (con o sin `--watch`) sobre el tsconfig del CLI que compila.
 *
 * El binario se resuelve **desde el paquete que llama**, no desde aquí: así `@mr/core-cli` no
 * necesita declarar `typescript`, que cada CLI ya tiene. TypeScript 7 dejó de exponer `./bin/tsc`
 * en su campo `exports`, así que se resuelve el `package.json` y se compone la ruta a mano.
 */
function runTsc(requireDelLlamante, tsconfig, watch) {
    const tscBin = resolve(dirname(requireDelLlamante.resolve("typescript/package.json")), "bin/tsc");
    const args = [tscBin, "--noEmit", "--project", tsconfig];
    if (watch) {
        args.push("--watch", "--preserveWatchOutput");
    }

    return new Promise(res => {
        spawn("node", args, {stdio: "inherit"}).on("close", code => res(code ?? 0));
    });
}

/**
 * Compila una CLI a `bin/min/<nombre>-run.js`.
 *
 * @param {object} config
 * @param {string} config.url     - El `import.meta.url` del config que llama. De ahí salen su
 *                                  directorio, su `package.json` y su resolución de dependencias.
 * @param {Record<string,string>} config.entry - Entradas, `{nombre: "ruta/relativa/main.ts"}`.
 * @param {boolean} [config.watch] - Modo watch.
 * @param {() => void} [config.alWatch] - Se llama una vez arrancado el watch, para lo que cada CLI
 *                                  quiera añadir (p. ej. `@mr/cli` arranca también el de `mrlang`).
 */
export async function compilar({url, entry, watch = false, alWatch}) {
    const _require = createRequire(url);
    const dir      = dirname(fileURLToPath(url));
    const pkg      = JSON.parse(readFileSync(resolve(dir, "../package.json"), "utf-8"));

    const outdir     = resolve(dir, "../bin/min");
    const tsconfig   = resolve(dir, "tsconfig.json");
    // Las `dependencies` de runtime son externas; los workspace devDeps (TypeScript sin compilar)
    // sí se bundlean.
    const external   = [...Object.keys(pkg.dependencies ?? {}), ...EXTRA_EXTERNAL];
    const entryPoints = Object.fromEntries(Object.entries(entry).map(([k, v]) => [k, resolve(dir, v)]));

    const compartido = {
        bundle:     true,
        platform:   "node",
        target:     "node24",
        format:     "cjs",
        external,
        define:     DEFINE,
        sourcemap:  true,
        minify:     !watch,
        outdir,
        // Genera <nombre>-run.js, que es lo que espera el arranque.
        entryNames: "[name]-run",
        tsconfig,
        logLevel:   "info",
    };

    if (watch) {
        // esbuild reconstruye al detectar cambios en disco, y `tsc --watch` corre en paralelo para
        // mostrar errores de tipos en tiempo real. No se limpia outdir: así el primer arranque es
        // inmediato.
        runTsc(_require, tsconfig, true); // no se await — el proceso vive indefinidamente

        const ctx = await context({...compartido, entryPoints});
        await ctx.watch();

        alWatch?.();

        console.log("esbuild: watching for changes (Ctrl+C to stop)...");

        return;
    }

    // Limpiar la salida anterior (equivalente a output.clean de rspack).
    rmSync(outdir, {recursive: true, force: true});

    // esbuild y tsc en paralelo. Falla si tsc reporta errores de tipos.
    const t0 = Date.now();
    const [, tscCode] = await Promise.all([
        build({...compartido, entryPoints}),
        runTsc(_require, tsconfig, false),
    ]);

    console.log(`\nesbuild: compilado en ${((Date.now() - t0) / 1000).toFixed(2)}s`);

    if (tscCode !== 0) {
        process.exitCode = 1;
    }
}
