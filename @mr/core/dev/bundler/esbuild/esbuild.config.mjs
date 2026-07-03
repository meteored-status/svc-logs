import {build, context} from "esbuild";
import {spawn} from "node:child_process";
import {existsSync, readFileSync, statSync} from "node:fs";
import {rm} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const tscBin = require.resolve("typescript/bin/tsc");

function readJSONSync(file) {
    try {
        return JSON.parse(readFileSync(file, "utf-8"));
    } catch {
        return null;
    }
}

function parseEnv(argv) {
    const env = {};
    for (let i = 0; i < argv.length; i += 1) {
        const actual = argv[i];
        if (actual === "--env") {
            const data = argv[i + 1];
            i += 1;
            if (data !== undefined) {
                const index = data.indexOf("=");
                if (index > 0) {
                    env[data.slice(0, index)] = data.slice(index + 1);
                }
            }
        } else if (actual.startsWith("--env=")) {
            const data = actual.slice("--env=".length);
            const index = data.indexOf("=");
            if (index > 0) {
                env[data.slice(0, index)] = data.slice(index + 1);
            }
        }
    }
    return env;
}

function getDefine({entorno, database}) {
    const desarrollo = entorno === "desarrollo";
    return {
        DESARROLLO: JSON.stringify(desarrollo),
        TEST: JSON.stringify(entorno === "test"),
        PRODUCCION: JSON.stringify(!desarrollo),
        ENTORNO: JSON.stringify(entorno),
        NEXTJS: JSON.stringify(false),
        DATABASE: JSON.stringify(database??""),
        "global.DESARROLLO": JSON.stringify(desarrollo),
        "global.TEST": JSON.stringify(entorno === "test"),
        "global.PRODUCCION": JSON.stringify(!desarrollo),
        "global.ENTORNO": JSON.stringify(entorno),
        "global.NEXTJS": JSON.stringify(false),
        "global.DATABASE": JSON.stringify(database??""),
    };
}

function getOptions(basedir, dependencies, entorno, database) {
    const desarrollo = !["produccion", "test"].includes(entorno);
    const define = getDefine({entorno, database});
    return {
        absWorkingDir: basedir,
        bundle: true,
        define,
        entryPoints: {
            app: path.resolve(basedir, "main.ts"),
        },
        format: "cjs",
        logLevel: "info",
        metafile: false,
        minify: !desarrollo,
        outdir: path.resolve(basedir, "output"),
        entryNames: "[name]",
        platform: "node",
        sourcemap: true,
        target: "node24",
        tsconfig: path.resolve(basedir, "tsconfig.json"),
        legalComments: "none",
        color: true,
        external: Object.keys(dependencies ?? {}),
    };
}

function runTsc(basedir, watchMode) {
    const args = ["--noEmit", "--project", path.resolve(basedir, "tsconfig.json")];
    if (watchMode) {
        args.push("--watch", "--preserveWatchOutput");
    }
    return new Promise((resolve) => {
        spawn("node", [tscBin, ...args], {stdio: "inherit"}).on("close", (code) => {
            resolve(code ?? 0);
        });
    });
}

function getDatabase(build, entorno) {
    if (entorno === "produccion") {
        return build.database?.produccion;
    }
    return build.database?.test;
}

function getBuildContext(basedir, entorno, manifest, dependencies) {
    const build = manifest.build ?? {};
    const framework = build.framework ?? "meteored";
    const runtime = manifest.deploy?.runtime ?? "node";
    if (runtime !== "node") {
        console.warn(`[WARN] ${path.basename(basedir)}: esbuild solo soporta runtime=node. Runtime actual: ${runtime}.`);
        return null;
    }
    if (framework === "nextjs") {
        console.warn(`[WARN] ${path.basename(basedir)}: esbuild no soporta framework=nextjs.`);
        return null;
    }
    if (existsSync(path.resolve(basedir, "rules.js")) && statSync(path.resolve(basedir, "rules.js")).isFile()) {
        console.warn(`[WARN] ${path.basename(basedir)}: rules.js no está soportado por esbuild y será ignorado.`);
    }
    return {
        basedir,
        dependencies,
        entorno,
        database: getDatabase(build, entorno),
    };
}

async function run() {
    const env = parseEnv(process.argv.slice(2));
    const entorno = env.entorno ?? "desarrollo";
    const rawDir = env.dir ?? process.cwd();
    const basedir = rawDir.replaceAll("\"", "");

    const packageJson = readJSONSync(path.resolve(basedir, "package.json"));
    if (packageJson === null) {
        throw new Error(`No se encontró package.json en: ${basedir}`);
    }
    const manifest = readJSONSync(path.resolve(basedir, "mrpack.json"));
    if (manifest === null) {
        throw new Error(`No se encontró mrpack.json en: ${basedir}`);
    }
    const buildContext = getBuildContext(basedir, entorno, manifest, packageJson.dependencies ?? {});
    if (buildContext === null) {
        console.log(`esbuild: sin entradas para compilar en ${basedir}`);
        return;
    }
    const options = getOptions(buildContext.basedir, buildContext.dependencies, buildContext.entorno, buildContext.database);

    const desarrollo = !["produccion", "test"].includes(entorno);
    const watchMode = process.argv.includes("--watch") || desarrollo;
    if (watchMode) {
        runTsc(basedir, true);
        const buildContext = await context(options);
        await buildContext.watch();
        console.log("esbuild: watching for changes (Ctrl+C to stop)...");
        return;
    }

    await rm(path.resolve(basedir, "output"), {
        force: true,
        recursive: true,
    });
    const time0 = Date.now();
    const [, tscCode] = await Promise.all([
        build(options),
        runTsc(basedir, false),
    ]);
    console.log(`\nesbuild: compilado en ${((Date.now() - time0) / 1000).toFixed(2)}s`);
    if (tscCode !== 0) {
        process.exitCode = 1;
    }
}

run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
