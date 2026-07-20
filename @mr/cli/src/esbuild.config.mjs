import {build, context} from "esbuild";
import {rmSync} from "node:fs";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, resolve} from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";

const _require  = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8"));

// Las dependencies de runtime son externas (no se bundlean).
// Los workspace devDeps (services-comun, @mr/core-*, etc.) SÍ se bundlean
// porque son TypeScript puro sin compilar.
//
// Excepción explícita (igual que en rspack.config.mjs):
//   - typescript:              devDep de build, 9MB de fuente, tiene dynamic requires internos.
//   - ts-checker-rspack-plugin: solo se usa durante la compilación de @mr/cli, no en runtime.
const EXTRA_EXTERNAL = ["typescript", "ts-checker-rspack-plugin"];
const external = [...Object.keys(pkg.dependencies ?? {}), ...EXTRA_EXTERNAL];

// Equivalente al DefinePlugin de rspack: inyecta las variables globales del entorno.
const define = {
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

const outdir      = resolve(__dirname, "../bin/min");
// TypeScript 7 ya no expone "./bin/tsc" en el campo "exports" de su package.json,
// así que resolvemos el paquete y componemos la ruta al binario manualmente.
const tscBin      = resolve(dirname(_require.resolve("typescript/package.json")), "bin/tsc");
// const tscBin      = require.resolve("typescript/bin/tsc");
const tsconfigPath = resolve(__dirname, "tsconfig.json");

const watch = process.argv.includes("--watch");

/**
 * Lanza `tsc --noEmit` (con o sin --watch).
 * Devuelve una Promise que se resuelve con el exit code cuando el proceso termina.
 * En modo watch el proceso nunca termina (la Promise nunca resuelve).
 */
function runTsc(watchMode) {
    const args = [tscBin, "--noEmit", "--project", tsconfigPath];
    if (watchMode) {
        args.push("--watch", "--preserveWatchOutput");
    }
    return new Promise(res => {
        spawn("node", args, {stdio: "inherit"}).on("close", code => res(code ?? 0));
    });
}

const sharedConfig = {
    bundle:      true,
    platform:    "node",
    target:      "node24",
    format:      "cjs",
    external,
    define,
    sourcemap:   true,
    minify:      !watch,
    outdir,
    // Genera mrpack-run.js / mrlang-run.js (mismo nombre que espera lib.js)
    entryNames:  "[name]-run",
    tsconfig:    resolve(__dirname, "tsconfig.json"),
    logLevel:    "info",
};

if (watch) {
    // Modo watch: esbuild reconstruye automáticamente al detectar cambios en disco.
    // tsc --watch corre en paralelo para mostrar errores de tipos en tiempo real.
    // No limpiamos outdir para que el primer arranque sea inmediato.
    runTsc(true); // no se await — el proceso vive indefinidamente

    const [ctxMrpack, ctxMrlang] = await Promise.all([
        context({...sharedConfig, entryPoints: {"mrpack": resolve(__dirname, "mrpack/main.ts")}}),
        context({...sharedConfig, entryPoints: {"mrlang": resolve(__dirname, "mrlang/main.ts")}}),
    ]);
    await Promise.all([ctxMrpack.watch(), ctxMrlang.watch()]);
    console.log("esbuild: watching for changes (Ctrl+C to stop)...");
} else {
    // Limpiar salida anterior (equivalente a output.clean: true de rspack)
    rmSync(outdir, {recursive: true, force: true});

    // esbuild y tsc corren en paralelo (igual que TsCheckerRspackPlugin).
    // El script falla si tsc reporta errores de tipos.
    const t0 = Date.now();
    const [, tscCode] = await Promise.all([
        Promise.all([
            build({
                ...sharedConfig,
                entryPoints: {"mrpack": resolve(__dirname, "mrpack/main.ts")},
            }),
            build({
                ...sharedConfig,
                entryPoints: {"mrlang": resolve(__dirname, "mrlang/main.ts")},
            }),
        ]),
        runTsc(false),
    ]);

    console.log(`\nesbuild: compilado en ${((Date.now() - t0) / 1000).toFixed(2)}s`);

    if (tscCode !== 0) {
        process.exitCode = 1;
    }
}
