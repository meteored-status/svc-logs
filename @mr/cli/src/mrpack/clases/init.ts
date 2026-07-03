/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 03 Jul 2026 07:12:34 GMT
 * Hash: 246e3b2e480ae9aeaa1ec119c4afc73d
 * Versión: 2026.7.3+1-josantoniojimnez
 * Anterior: 2026.7.2+5-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-ads.git
 */

import {dump as yamlDump, load as yamlLoad} from "js-yaml";
import {lstat, readlink, symlink} from "node:fs/promises";
import {resolve} from "node:path";

import {BuildBundler, BuildFW} from "@mr/core-dev/manifest/build";
import type {Manifest} from "@mr/core-dev/manifest";
import {Runtime} from "@mr/core-dev/manifest/deployment";
import {
    isDir,
    isFile,
    readDir,
    readFileString,
    readJSON,
    rename,
    safeWrite,
    unlink,
} from "services-comun/modules/utiles/fs";
import {md5} from "services-comun/modules/utiles/hash";

import {Colors} from "./colors";
import {Comando} from "./comando";
import type {IManifestLegacy} from "./manifest/workspace/legacy";
import {type IPackageFW, PaqueteTipo} from "./paquete";
import type {IPackageJson as IPackageJsonBase, IPackageJsonLegacy} from "./packagejson";
import type {IConfigServices} from "./workspace/service";
import {FrameworkUpdates, sanitizeFrameworkUpdates} from "./workspace/service";
import {ManifestRootLoader} from "./manifest/root";
import {ManifestWorkspaceLoader} from "./manifest/workspace";
import {add, checkCliente as checkClienteFW, recompilarCliente} from "./framework";
import {install} from "./yarn";

import APP from "./init/app";
import ATTRIBUTES from "./init/attributes";
import DEVEL from "./init/devel";
import DATADOG from "./init/datadog";
import EDITORCONFIG from "./init/editorconfig";
import IGNORE from "./init/ignore";

/**
 * Estructura tipada del fichero `.yarnrc.yml`.
 *
 * @property approvedGitRepositories - Lista de repositorios git autorizados.
 * @property checksumBehavior        - Comportamiento ante checksums incorrectos (`"throw"` o `false`).
 * @property compressionLevel        - Nivel de compresión del caché (`mixed`, `normal`, etc.).
 * @property enableGlobalCache       - Si `true`, usa la caché global de Yarn.
 * @property enableHardenedMode      - Si `true`, activa el modo endurecido de Yarn.
 * @property enableScripts           - Si `false`, deshabilita los scripts de instalación.
 * @property enableStrictSsl         - Si `true`, fuerza la validación estricta de certificados SSL.
 * @property npmMinimalAgeGate       - Edad mínima de un paquete npm para ser instalado (minutos).
 * @property packageExtensions       - Extensiones de dependencias de paquetes de terceros.
 * @property plugins                 - Plugins de Yarn activos.
 * @property unsafeHttpWhitelist     - Lista de hosts permitidos por HTTP sin cifrar.
 * @property yarnPath                - Ruta al ejecutable de Yarn.
 */
interface IYarnRC {
    approvedGitRepositories?: string[];
    checksumBehavior?: "throw"|false;
    compressionLevel?: string;
    enableGlobalCache?: boolean;
    enableHardenedMode?: boolean;
    enableStrictSsl?: boolean;
    enableScripts?: boolean;
    npmMinimalAgeGate?: number;
    packageExtensions?: Record<string, {dependencies?: Record<string, string>}>;
    plugins?: unknown[];
    unsafeHttpWhitelist?: string[];
    yarnPath?: string;
}

interface IConfiguracion {
    // openTelemetry: boolean;
    cambio: boolean;
}

function sanitizePatch(value: unknown): string|undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const patch = value.trim().toUpperCase();
    if (!/^R\d+$/.test(patch)) {
        return undefined;
    }
    return patch;
}

export interface IPackageJson extends IPackageJsonBase {
    config?: IManifestLegacy;
}

interface IWorkspaces {
    dir: string;
    workspaces: string[];
}

export async function init(basedir: string): Promise<boolean> {
    console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Inicializando"));
    console.group();

    await checkCliente(basedir);
    const workspaces = await initBase(basedir);
    await deleteFiles(basedir);
    await limpiarLegacy(basedir);
    await corregirGITs(basedir);

    const config = await initWorkspaces(basedir, workspaces);
    await initConfig(basedir, workspaces);

    const cambio = await initYarnRC(basedir/*, config*/);

    await initGithub(basedir);
    await initAgents(basedir);

    if (await isDir(`${basedir}/i18n`)) {
        console.log(Colors.colorize([Colors.FgWhite], "Inicializando i18n"));
        const {status, stderr} = await Comando("yarn", ["mrlang", "init"], {cwd: basedir});
        if (status!=0) {
            console.error(stderr);
            console.groupEnd();
            return Promise.reject(new Error("Error al inicializar i18n"));
        }
    }

    console.groupEnd();

    if (cambio || config.cambio) {
        await install(basedir, {verbose:false});

        return true;
    }

    return false;
}

async function checkFiles(config: Manifest, basedir: string): Promise<void> {
    if (config.deploy.runtime===Runtime.node && config.build.framework!==BuildFW.nextjs) {
        await Promise.all([
            safeWrite(`${basedir}/app.js`, APP({type: config.deploy.type}), true),
            safeWrite(`${basedir}/devel.js`, DEVEL, true),
        ]);
    }

    if (await isFile(`${basedir}/init.js`)) {
        console.log(Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/init.js`));
        await unlink(`${basedir}/init.js`);
    }

    if (await isFile(`${basedir}/output/.foreverignore`)) {
        console.log(Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/output/.foreverignore`));
        await unlink(`${basedir}/output/.foreverignore`);
    }
    if (await isFile(`${basedir}/output/devel.js`)) {
        console.log(Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/output/devel.js`));
        await unlink(`${basedir}/output/devel.js`);
    }
    if (await isFile(`${basedir}/output/devel.js.map`)) {
        console.log(Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/output/devel.js.map`));
        await unlink(`${basedir}/output/devel.js.map`);
    }
    if (await isFile(`${basedir}/pack.js`)) {
        console.log(Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/pack.js`));
        await unlink(`${basedir}/pack.js`);
    }

    if (await isFile(`${basedir}/Dockerfile`)) {
        let contenido = await readFileString(`${basedir}/Dockerfile`);
        let cambio = false;
        if (contenido.includes("ARG ws") && !contenido.includes("ARG RUTA")) {
            contenido = contenido.replace("ARG ws", "ARG RUTA\nARG WS");
            contenido = contenido.replaceAll("/services/", "/${RUTA}/")
            contenido = contenido.replaceAll("${ws}", "${WS}")
            cambio = true;
        }
        if (!contenido.includes("COPY ./${RUTA}/${WS}/mrpack.json")) {
            contenido = contenido.replace("COPY ./${RUTA}/${WS}/package.json ./${RUTA}/${WS}", "COPY ./${RUTA}/${WS}/mrpack.json ./${RUTA}/${WS}\nCOPY ./${RUTA}/${WS}/package.json ./${RUTA}/${WS}");
            cambio = true;
        }
        if (contenido.includes("COPY ./${RUTA}/${WS}/init.js ./${RUTA}/${WS}")) {
            contenido = contenido.replace("COPY ./${RUTA}/${WS}/init.js ./${RUTA}/${WS}\n", "");
            cambio = true;
        }
        if (config.deploy.runtime===Runtime.node && !contenido.includes("COPY ./yarn.lock ./\nENV NODE_ENV=production")) {
            contenido = contenido.replace("COPY ./yarn.lock ./", "COPY ./yarn.lock ./\nENV NODE_ENV=production");
            cambio = true;
        }
        if (!contenido.includes("RUN apk add --no-cache tzdata")) {
            contenido = contenido.replaceAll("WORKDIR /usr/src/app\n", "WORKDIR /usr/src/app\nRUN apk add --no-cache tzdata\n");
            cambio = true;
        }
        if (cambio) {
            console.log(Colors.colorize([Colors.FgYellow], `Corrigiendo ${basedir}/Dockerfile`));
            await safeWrite(`${basedir}/Dockerfile`, contenido, true);
        }
    }
}

function reduceConfig(configs: IConfiguracion[]): IConfiguracion {
    return configs.reduce((prev, actual)=>{
        return {
            // openTelemetry: prev.openTelemetry || actual.openTelemetry,
            cambio: prev.cambio || actual.cambio,
        };
    }, {
        // openTelemetry: false,
        cambio: false,
    });
}

async function isValid(dir: string): Promise<boolean> {
    return await isDir(dir) && await isFile(`${dir}/package.json`)
}

async function checkCliente(basedir: string): Promise<void> {
    console.log(Colors.colorize([Colors.FgWhite], `Comprobando cliente`));
    console.group();

    await autocorregir(basedir);

    const hash = await checkClienteFW(basedir);
    await add(basedir, [
        "@mr/core/dev",
        "@mr/core/i18n",
        "@mr/core/network",
    ]);
    if (hash!=undefined) {
        await recompilarCliente(basedir, hash);
    }

    console.groupEnd();
}

async function initBase(basedir: string): Promise<IWorkspaces[]> {
    console.log(Colors.colorize([Colors.FgWhite], "Inicializando proyecto"));
    console.group();
    const cronjobs: string[] = [];
    const jobs: string[] = [];
    const services: string[] = [];
    const scripts: string[] = [];

    const paquete = await readJSON<IPackageJsonBase>(`${basedir}/package.json`);
    paquete.scripts = {
        // "mrlang": "yarn workspace @mr/cli mrlang",
        // "mrpack": "yarn workspace @mr/cli mrpack",
        "doctor": "yarn dlx @yarnpkg/doctor",
        "devel": "yarn mrpack devel -e",
        "devel-f": "yarn mrpack devel -e -f",
        "g:devel": "cd \"$INIT_CWD\" && yarn node --watch --no-warnings devel.js",
        "packd": "yarn mrpack devel -c",
        "packd-f": "yarn mrpack devel -c -f",
        "g:rspack": "yarn workspace @mr/core-dev rspack --env entorno=desarrollo --env dir=\"$INIT_CWD\" --config \"bundler/rspack/rspack.config.ts\"",
        "g:esbuild": "yarn workspace @mr/core-dev node bundler/esbuild/esbuild.config.mjs --env entorno=desarrollo --env dir=\"$INIT_CWD\"",
        "g:nextjs": "cd \"$INIT_CWD\" && yarn run next dev -p ${NEXTJS_PORT:-8080}",
        "update": "yarn mrpack update",
        "patch:apply": "yarn workspace @mr/core-dev mrpack:patch:apply"
    };
    const bin = paquete.bin!=undefined;
    paquete.bin ??= {};
    paquete.bin["mrlang"] = "@mr/cli/bin/mrlang.js";
    paquete.bin["mrpack"] = "@mr/cli/bin/mrpack.js";

    if (await isDir(`${basedir}/framework`)) {
        for (const actual of await readDir(`${basedir}/framework`)) {
            if (await isValid(`${basedir}/framework/${actual}`)) {
                paquete.scripts[actual] = `yarn workspace ${actual}`;
            } else {
                await unlink(`${basedir}/framework/${actual}`);
            }
        }
    }

    if (await isDir(`${basedir}/cronjobs`)) {
        for (const actual of await readDir(`${basedir}/cronjobs`)) {
            if (await isValid(`${basedir}/cronjobs/${actual}`)) {
                paquete.scripts[actual] = `yarn workspace ${actual}`;
                cronjobs.push(actual);
            } else {
                await unlink(`${basedir}/cronjobs/${actual}`);
            }
        }
    }

    if (await isDir(`${basedir}/jobs`)) {
        for (const actual of await readDir(`${basedir}/jobs`)) {
            if (await isValid(`${basedir}/jobs/${actual}`)) {
                paquete.scripts[actual] = `yarn workspace ${actual}`;
                jobs.push(actual);
            } else {
                await unlink(`${basedir}/jobs/${actual}`);
            }
        }
    }

    if (await isDir(`${basedir}/services`)) {
        for (const actual of await readDir(`${basedir}/services`)) {
            if (await isValid(`${basedir}/services/${actual}`)) {
                paquete.scripts[actual] = `yarn workspace ${actual}`;
                services.push(actual);
            } else {
                await unlink(`${basedir}/services/${actual}`);
            }
        }
    }

    if (await isDir(`${basedir}/packages`)) {
        for (const actual of await readDir(`${basedir}/packages`)) {
            if (await isValid(`${basedir}/packages/${actual}`)) {
                paquete.scripts[actual] = `yarn workspace ${actual}`;
            } else {
                await unlink(`${basedir}/packages/${actual}`);
            }
        }
    }

    if (await isDir(`${basedir}/scripts`)) {
        for (const actual of await readDir(`${basedir}/scripts`)) {
            if (await isValid(`${basedir}/scripts/${actual}`)) {
                paquete.scripts[actual] = `yarn workspace ${actual}`;
                scripts.push(actual);
            } else {
                await unlink(`${basedir}/scripts/${actual}`);
            }
        }
    }

    if (await isDir(`${basedir}/i18n`)) {
        paquete.scripts["i18n"] = "yarn workspace i18n";
    }

    paquete.workspaces = [
        "@mr/cli",
        "@mr/core/*",
        "@mr/user/*",
        "cronjobs/*",
        "framework/*",
        "i18n",
        "jobs/*",
        "packages/*",
        "scripts/*",
        "services/*",
        "statics/*",
        "tests/*"
    ];
    if (paquete.dependencies!=undefined) {
        delete paquete.dependencies;
    }
    if (paquete.devDependencies!=undefined) {
        delete paquete.devDependencies;
    }

    paquete.resolutions??={};
    delete paquete.resolutions["@elastic/elasticsearch"];
    delete paquete.resolutions["@types/node"];
    delete paquete.resolutions["mysql2"];
    delete paquete.resolutions["gaxios"];
    delete paquete.resolutions["node-fetch"];
// paquete.resolutions["mysql2"] = "3.11.0";
    if (Object.keys(paquete.resolutions).length == 0) {
        delete paquete.resolutions;
    }

    await safeWrite(`${basedir}/.editorconfig`, EDITORCONFIG, true);
    await safeWrite(`${basedir}/.gitattributes`, ATTRIBUTES, true);
    await safeWrite(`${basedir}/.gitignore`, IGNORE, true);
    await safeWrite(`${basedir}/.node-version`, "lts-latest\n", true);
    if (await isFile(`${basedir}/.sonarcloud.properties`)) {
        await unlink(`${basedir}/.sonarcloud.properties`);
    }
    if (await isFile(`${basedir}/@mr/cli/.run/develop =_ Compilar.run.xml`)) {
        await unlink(`${basedir}/@mr/cli/.run/develop =_ Compilar.run.xml`);
    }
    if (await isFile(`${basedir}/@mr/cli/.run/develop =_ Compilar (Todos).run.xml`)) {
        await unlink(`${basedir}/@mr/cli/.run/develop =_ Compilar (Todos).run.xml`);
    }
    if (await isFile(`${basedir}/@mr/cli/.run/develop =_ Ejecutar.run.xml`)) {
        await unlink(`${basedir}/@mr/cli/.run/develop =_ Ejecutar.run.xml`);
    }
    await safeWrite(`${basedir}/static-analysis.datadog.yml`, DATADOG, true);
    await safeWrite(`${basedir}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);

    await checkRootManifest(basedir);

    if (!bin) {
        await install(basedir, {verbose:false});
    }

// todo inicializar el manifest de Root

    console.groupEnd();

    return [
        {
            dir: "cronjobs",
            workspaces: cronjobs,
        }, {
            dir: "jobs",
            workspaces: jobs,
        },{
            dir: "services",
            workspaces: services,
        }, {
            dir: "scripts",
            workspaces: scripts,
        },
    ];
}

async function checkRootManifest(basedir: string): Promise<void> {
    await new ManifestRootLoader(basedir).load();
}

async function deleteFiles(basedir: string): Promise<void> {
    console.log(Colors.colorize([Colors.FgWhite], "Revisando archivos innecesarios"));
    console.group();
    for (const file of ["update.sh", "run.sh"]) {
        const item = `${basedir}/${file}`;
        if (await isFile(item) || await isDir(item)) {
            console.log(`Eliminando ${Colors.colorize([Colors.FgYellow], file)}`);
            await unlink(item);
        }
    }
    for (const file of ["status.json", "bin/mrdev.js"]) {
        const item = `${basedir}/@mr/cli/${file}`;
        if (await isFile(item) || await isDir(item)) {
            console.log(`Eliminando ${Colors.colorize([Colors.FgYellow], `@mr/cli/${file}`)}`);
            await unlink(item);
        }
    }
    for (const actual of await readDir(`${basedir}/framework`)) {
        for (const file of ["download.js", "status.json", "upload.js", "files"]) {
            const item = `${basedir}/framework/${actual}/${file}`;
            if (await isFile(item) || await isDir(item)) {
                console.log(`Eliminando ${Colors.colorize([Colors.FgYellow], `${actual}/${file}`)}`);
                await unlink(item);
            }
        }
    }

    console.groupEnd();
}

async function corregirGITs(basedir: string): Promise<void> {
    console.log(Colors.colorize([Colors.FgWhite], "Corrigiendo conflictos de GIT"));
    console.group();

    await corregirGIT(basedir, "services-comun", "/", "CHANGELOG.md", ["changelog.md"]);

    console.groupEnd();
}

async function corregirGIT(basedir: string, framework: string, subdir: string, bueno: string, malos: string[]): Promise<void> {
    const dir = `${basedir}/framework/${framework}${subdir}`;
    if (!await isDir(dir)) {
        return;
    }

    let malo: string|undefined;
    const files = await readDir(dir);
    for (const file of malos) {
        if (files.includes(file)) {
            malo = file;
            break;
        }
    }
    if (!malo) {
        // nada que corregir
        return;
    }

    console.log(`Corrigiendo ${Colors.colorize([Colors.FgYellow], `${framework}${subdir}${bueno}`)}`);

// desactivamos el case-sensitive de git temporalmente
    {
        const {status, stderr} = await Comando("git", ["config", "core.ignorecase", "false"], {cwd: basedir});
        if (status !== 0) {
            console.error("Error corrigiendo", framework, stderr);
            return;
        }
    }

// eliminamos del repositorio el archivo con el nombre tanto correcto como incorrecto
    for (const file of [bueno, ...malos]) {
        await Comando("git", ["rm", "-r", "--cached", `framework/${framework}${subdir}${file}`], {cwd: basedir});
    }

    {
        const {status} = await Comando("git", ["commit", "-m", `"Corrigiendo archivos conflictivos"`], {cwd: basedir});
        if (status !== 0) {
            // rehabilitamos el case-sensitive de git
            await Comando("git", ["config", "core.ignorecase", "true"], {cwd: basedir});
            return;
        }
    }

// renombramos el archivo incorrecto al correcto
    await rename(`${dir}${malo}`, `${dir}${bueno}`);

// rehabilitamos el case-sensitive de git
    await Comando("git", ["config", "core.ignorecase", "true"], {cwd: basedir});
}

async function autocorregir(basedir: string): Promise<void> {
    const paquete = await readJSON<IPackageFW>(`${basedir}/@mr/cli/package.json`);
    if (paquete.config===undefined || paquete.config.bucket===undefined || paquete.config.tipo===undefined) {
        console.log(Colors.colorize([Colors.FgYellow], "Autocorrigiendo posibles errores"));
        paquete.config = {
            bucket: "meteored-yarn-packages",
            subible: true,
            tipo: PaqueteTipo.root,
        };
        await safeWrite(`${basedir}/@mr/cli/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
    }
}

async function limpiarLegacy(basedir: string): Promise<void> {
    console.log(Colors.colorize([Colors.FgWhite], "Limpiando frameworks legacy"));
    console.group();

    await limpiarLegacyEjecutar(basedir, "services-comun", ["tools"]);

    console.groupEnd();
}

async function limpiarLegacyEjecutar(basedir: string, framework: string, items: string[]): Promise<void> {
    for (const item of items) {
        const dir = `${basedir}/framework/${framework}/${item}`;
        if (await isFile(dir) || await isDir(dir)) {
            console.log(`Limpiando ${Colors.colorize([Colors.FgYellow], `${framework}/${item}`)}`);
            await unlink(dir);
        }
    }
}

async function loadConfig(basedir: string): Promise<{paquete: IPackageJson, config: Manifest}> {
    const paquete = await readJSON<IPackageJson>(`${basedir}/package.json`);
    let config: ManifestWorkspaceLoader;
    if (paquete.config!==undefined) {
        config = new ManifestWorkspaceLoader(basedir).fromLegacy(paquete.config, paquete);
        await config.save();
        delete paquete.config;
        await safeWrite(`${basedir}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
    } else if ("servicio" in paquete) {
        config = await new ManifestWorkspaceLoader(basedir).load(false, paquete as IPackageJsonLegacy);
        delete paquete.servicio;
        await safeWrite(`${basedir}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
    } else {
        config = await new ManifestWorkspaceLoader(basedir).load();
    }
    const bundlerNormalizado = getBundlerNormalizado(config.manifest, paquete.dependencies);
    if (config.manifest.build.bundler!==bundlerNormalizado) {
        config.manifest.build.bundler = bundlerNormalizado;
        await config.save();
    }

    return {paquete, config: config.manifest};
}

function getBundlerCoherente(config: Manifest, dependencies?: Record<string, string>): BuildBundler {
    switch (config.deploy.runtime) {
        case Runtime.browser:
            return BuildBundler.rspack;
        case Runtime.cfworker:
        case Runtime.php:
            return BuildBundler.none;
        case Runtime.node:
        default:
            if (config.build.framework===BuildFW.nextjs) {
                return BuildBundler.none;
            }
            if (config.build.bundle.toJSON()?.componentes!=undefined && Object.keys(config.build.bundle.toJSON()?.componentes ?? {}).length>0) {
                return BuildBundler.rspack;
            }
            if (dependencies?.["reflect-metadata"]!=undefined) {
                // esbuild no genera decoratorMetadata; rspack (swc-loader) sí lo soporta.
                return BuildBundler.rspack;
            }
            return BuildBundler.esbuild;
    }
}

function getBundlerNormalizado(config: Manifest, dependencies?: Record<string, string>): BuildBundler {
    const bundlerEsperado = getBundlerCoherente(config, dependencies);
    if (bundlerEsperado===BuildBundler.esbuild && config.build.bundler===BuildBundler.rspack) {
        return BuildBundler.rspack;
    }
    return bundlerEsperado;
}

function checkScripts(config: Manifest, scripts: Record<string, string>, dependencies?: Record<string, string>): void {
    const getNextJSPort = (script: string|undefined): string => {
        if (script==undefined) {
            return "8080";
        }
        const actual = script.match(/(?:^|\s)NEXTJS_PORT=(\d+)(?=\s|$)/);
        if (actual!=undefined) {
            return actual[1];
        }
        const legacy = script.match(/next\s+dev\b.*?(?:-p|--port)[=\s]+(\d+)/);
        if (legacy!=undefined) {
            return legacy[1];
        }
        return "8080";
    };
    config.build.bundler = getBundlerNormalizado(config, dependencies);
    switch(config.deploy.runtime) {
        case Runtime.cfworker:
            scripts["packd"] = `yarn tsc --noemit --watch`;
            // scripts["devel"] = "wrangler dev --remote --env test";
            scripts["devel"] = "wrangler dev -e test --ip local.tiempo.com --port 3500 --local-protocol https --https-cert-path ./files/fullchain.pem --https-key-path ./files/privkey.pem";
            return;
        case Runtime.node:
            if (config.build.framework===BuildFW.nextjs) {
                const nextJSPort = getNextJSPort(scripts["dev"]);
                scripts["dev"] = `NEXTJS_PORT=${nextJSPort} yarn g:nextjs`;
                delete scripts["packd"];
                return;
            }
            scripts["packd"] = config.build.bundler===BuildBundler.esbuild ? "yarn g:esbuild" : "yarn g:rspack";
            if (!config.deploy.cronjob) {
                scripts["devel"] = "yarn g:devel";
            } else {
                scripts["devel"] = "yarn node --no-warnings devel.js";
            }
            return;
        default:
            if (config.build.bundler===BuildBundler.esbuild) {
                scripts["packd"] = "yarn g:esbuild";
            } else if (config.build.bundler===BuildBundler.rspack) {
                scripts["packd"] = "yarn g:rspack";
            } else {
                delete scripts["packd"];
            }
            return;
    }
}

function checkDependencies(config: Manifest, dependencies: Record<string, string>, devDependencies: Record<string, string>, optionalDependencies: Record<string, string>, defecto: Record<string, string>): void {
    // let openTelemetry = false;
    if (devDependencies["tslib"]!=undefined) {
        dependencies["tslib"] = devDependencies["tslib"];
        delete devDependencies["tslib"];
    } else if (dependencies["tslib"]==undefined) {
        dependencies["tslib"] = "*";
    }
    if (devDependencies["@mr/core-dev"]===undefined) {
        devDependencies["@mr/core-dev"] = "workspace:*";
    }
    if (devDependencies["@mr/core-i18n"]===undefined) {
        devDependencies["@mr/core-i18n"] = "workspace:*";
    }
    if (devDependencies["@mr/core-network"]===undefined) {
        devDependencies["@mr/core-network"] = "workspace:*";
    }
    if (dependencies["@mr/core-network"]!==undefined) {
        delete dependencies["@mr/core-network"];
    }

    if (config.build.framework!=BuildFW.nextjs) {
        dependencies["source-map-support"] ??= defecto["source-map-support"]??"*";

        for (const [lib, version] of Object.entries(defecto)) {
            if (dependencies[lib] != undefined) {
                dependencies[lib] = version;
            }
            if (devDependencies[lib] != undefined) {
                devDependencies[lib] = version;
            }
        }
        if (!config.deploy.cronjob) {
            dependencies["chokidar"] ??= defecto["chokidar"]??"*";
            dependencies["hexoid"] ??= defecto["hexoid"]??"*";
            dependencies["formidable"] ??= defecto["formidable"]??"*";
            dependencies["ws"] ??= defecto["ws"]??"*";
            optionalDependencies["bufferutil"] ??= defecto["bufferutil"]??"*";

            if (dependencies["@google-cloud/trace-agent"] != undefined) {
                delete dependencies["@google-cloud/trace-agent"];
            }
            if (dependencies["@opentelemetry/context-async-hooks"] != undefined) {
                delete dependencies["@opentelemetry/context-async-hooks"];
            }
            if (devDependencies["formidable"] != undefined) {
                delete devDependencies["formidable"];
            }

            // openTelemetry = true;
        }

        if (devDependencies["source-map-support"] != undefined) {
            delete devDependencies["source-map-support"];
        }
    }
    if (dependencies["@google-cloud/opentelemetry-cloud-trace-exporter"]!=undefined) {
        delete dependencies["@google-cloud/opentelemetry-cloud-trace-exporter"];
    }
    if (dependencies["@opentelemetry/api"]!=undefined) {
        delete dependencies["@opentelemetry/api"];
    }
    if (dependencies["@opentelemetry/core"]!=undefined) {
        delete dependencies["@opentelemetry/core"];
    }
    if (dependencies["@opentelemetry/instrumentation"]!=undefined) {
        delete dependencies["@opentelemetry/instrumentation"];
    }
    if (dependencies["@opentelemetry/instrumentation-http"]!=undefined) {
        delete dependencies["@opentelemetry/instrumentation-http"];
    }
    if (dependencies["@opentelemetry/resources"]!=undefined) {
        delete dependencies["@opentelemetry/resources"];
    }
    if (dependencies["@opentelemetry/sdk-trace-base"]!=undefined) {
        delete dependencies["@opentelemetry/sdk-trace-base"];
    }
    if (dependencies["@opentelemetry/sdk-trace-node"]!=undefined) {
        delete dependencies["@opentelemetry/sdk-trace-node"];
    }
    if (dependencies["@opentelemetry/semantic-conventions"]!=undefined) {
        delete dependencies["@opentelemetry/semantic-conventions"];
    }
    dependencies["dd-trace"] ??= defecto["dd-trace"]??"*";

// return openTelemetry;
}

/**
 * Traduce el nombre npm de un paquete `@mr/*` a su ruta absoluta dentro del monorepo.
 *
 * - `@mr/core-X` → `{root}/@mr/core/X`
 * - `@mr/user-X` → `{root}/@mr/user/X`
 * - `@mr/cli`    → `{root}/@mr/cli`
 *
 * @param root   - Raíz absoluta del monorepo.
 * @param nombre - Nombre npm del paquete (p.ej. `@mr/core-dev`).
 * @returns Ruta absoluta del directorio del paquete, o `undefined` si no corresponde a un paquete `@mr/*`.
 */
function mrNombreADir(root: string, nombre: string): string | undefined {
    const coreMatch = nombre.match(/^@mr\/core-(.+)$/);
    if (coreMatch) return `${root}/@mr/core/${coreMatch[1]}`;
    const userMatch = nombre.match(/^@mr\/user-(.+)$/);
    if (userMatch) return `${root}/@mr/user/${userMatch[1]}`;
    if (nombre === "@mr/cli") return `${root}/@mr/cli`;
    return undefined;
}

/**
 * Compara dos rangos de versión npm y devuelve el más reciente.
 * Soporta prefijos `^`, `~`, `>=`, etc. Si alguno es `*`, prefiere el otro.
 *
 * @param a - Primer rango de versión.
 * @param b - Segundo rango de versión.
 * @returns El rango de versión más reciente entre `a` y `b`.
 */
function versionMasReciente(a: string, b: string): string {
    if (a === "*") return b;
    if (b === "*") return a;
    const parsear = (v: string): number[] =>
        v.replace(/^[^0-9]*/, "").split(/[-+]/)[0].split(".").map(n => parseInt(n, 10) || 0);
    const [aMaj, aMin = 0, aPat = 0] = parsear(a);
    const [bMaj, bMin = 0, bPat = 0] = parsear(b);
    if (bMaj !== aMaj) return bMaj > aMaj ? b : a;
    if (bMin !== aMin) return bMin > aMin ? b : a;
    return bPat > aPat ? b : a;
}

/**
 * Opciones de `resolverDepsTransitivas`.
 *
 * @property visitados - Conjunto de nombres de paquete ya procesados (evita ciclos).
 * @property campo     - Campo del `package.json` a recopilar (`dependencies` u `optionalDependencies`).
 */
interface IResolverDepsTransitivasConfig {
    visitados?: Set<string>;
    campo?: "dependencies" | "optionalDependencies";
}

/**
 * Resuelve de forma recursiva las dependencias del campo indicado de todos los paquetes
 * `@mr/*` declarados como `devDependencies`, sin referencias circulares.
 *
 * @param root    - Raíz absoluta del monorepo.
 * @param devDeps - Mapa de devDependencies del paquete a analizar.
 * @param config  - Opciones: conjunto de nombres ya procesados y campo a recopilar.
 * @returns Mapa de dependencias acumuladas.
 */
async function resolverDepsTransitivas(root: string, devDeps: Record<string, string>, config: IResolverDepsTransitivasConfig = {}): Promise<Record<string, string>> {
    const {visitados = new Set<string>(), campo = "dependencies"} = config;
    const resultado: Record<string, string> = {};

    for (const nombre of Object.keys(devDeps)) {
        if (!nombre.startsWith("@mr/")) continue;
        if (visitados.has(nombre)) continue;
        visitados.add(nombre);

        const dir = mrNombreADir(root, nombre);
        if (dir === undefined) continue;

        const pkg = await readJSON<IPackageJsonBase>(`${dir}/package.json`).catch(() => undefined);
        if (pkg === undefined) continue;

        for (const [dep, version] of Object.entries(pkg[campo] ?? {})) {
            if (dep.startsWith("@mr/")) continue;
            if (version.startsWith("workspace:")) continue;
            resultado[dep] = resultado[dep] !== undefined
                ? versionMasReciente(resultado[dep], version)
                : version;
        }

        const transitivas = await resolverDepsTransitivas(root, pkg.devDependencies ?? {}, {visitados, campo});
        for (const [dep, version] of Object.entries(transitivas)) {
            resultado[dep] = resultado[dep] !== undefined
                ? versionMasReciente(resultado[dep], version)
                : version;
        }
    }

    return resultado;
}

async function initWorkspace(basedir: string, monorepoRoot: string, dependenciesDefecto: Record<string, string>): Promise<IConfiguracion> {
    const salida: IConfiguracion = {
        // openTelemetry: false,
        cambio: false,
    };

    const {paquete, config} = await loadConfig(basedir);
    const hash = md5(JSON.stringify(paquete));
    if (config.enabled) {
        paquete.version = "0000.00.00-000";
        checkScripts(config, paquete.scripts ??= {}, paquete.dependencies);

        if (config.deploy.runtime==Runtime.node) {
            checkDependencies(config, paquete.dependencies??={}, paquete.devDependencies??={}, paquete.optionalDependencies??={}, dependenciesDefecto);
            // salida.openTelemetry = this.checkDependencies(config, paquete.dependencies??={}, paquete.devDependencies??={}, dependenciesDefecto);

            const devDeps = paquete.devDependencies ?? {};

            // Propagar dependencies y optionalDependencies en paralelo (mismo árbol, doble lectura evitada)
            const [transitivas, transitivasOpt] = await Promise.all([
                resolverDepsTransitivas(monorepoRoot, devDeps, {visitados: new Set(), campo: "dependencies"}),
                resolverDepsTransitivas(monorepoRoot, devDeps, {visitados: new Set(), campo: "optionalDependencies"}),
            ]);
            for (const [dep, version] of Object.entries(transitivas)) {
                const deps = paquete.dependencies ??= {};
                deps[dep] = deps[dep] !== undefined ? versionMasReciente(deps[dep], version) : version;
            }
            // bufferutil debe estar solo en optionalDependencies, nunca en dependencies
            delete (paquete.dependencies ?? {})["bufferutil"];

            for (const [dep, version] of Object.entries(transitivasOpt)) {
                const optDeps = paquete.optionalDependencies ??= {};
                optDeps[dep] = optDeps[dep] !== undefined ? versionMasReciente(optDeps[dep], version) : version;
            }

            if (Object.keys(paquete.dependencies).length===0) {
                delete paquete.dependencies;
            }
            if (Object.keys(paquete.devDependencies).length===0) {
                delete paquete.devDependencies;
            }
            if (Object.keys(paquete.optionalDependencies ?? {}).length===0) {
                delete paquete.optionalDependencies;
            }
        }

        await safeWrite(`${basedir}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
    }

    await checkFiles(config, `${basedir}`);

    salida.cambio = hash!==md5(JSON.stringify(paquete));

    return salida;
}

async function initWorkspaces(basedir: string, workspaces: IWorkspaces[]): Promise<IConfiguracion> {
    console.log(Colors.colorize([Colors.FgWhite], "Inicializando workspaces"));
    console.group();

    const {devDependencies: paquetePropio={}} = await readJSON<IPackageJsonBase>(`${basedir}/framework/services-comun/package.json`);

    const promesas: Promise<IConfiguracion>[] = [];
    for (const carpeta of workspaces) {
        for (const workspace of carpeta.workspaces) {
            promesas.push(initWorkspace(`${basedir}/${carpeta.dir}/${workspace}`, basedir, paquetePropio));
        }
    }

    const config = reduceConfig(await Promise.all(promesas));

    console.groupEnd();
    return config;
}

async function initConfig(basedir: string, workspaces: IWorkspaces[]): Promise<void> {
    console.log(Colors.colorize([Colors.FgWhite], "Inicializando configuración personal de workspaces"));
    console.group();

    function sort(a: string, b: string): number {
        return a.localeCompare(b);
    }

    const file = `${basedir}/config.workspaces.json`;
    const salida: IConfigServices = {
        devel: {
            available: [],
            disabled: [],
        },
        packd: {
            available: [],
            disabled: [],
        },
        i18n: true,
        services: {},
        framework: {
            updates: FrameworkUpdates.all,
        },
    };

    interface IProyecto {
        nombre: string;
        compilable: boolean;
        ejecutable: boolean;
    }

    const proyectos: IProyecto[] = [];
    for (const carpeta of workspaces) {
        for (const nombre of carpeta.workspaces) {
            const {manifest} = new ManifestWorkspaceLoader(`${basedir}/${carpeta.dir}/${nombre}`).loadSync();
            proyectos.push({
                nombre,
                compilable: manifest.deploy.runtime !== Runtime.php,
                ejecutable: manifest.deploy.runtime === Runtime.node,
            });
        }
    }

    const ejecutables = new Set(proyectos.filter(p => p.ejecutable).map(p => p.nombre));
    const compilables = new Set(proyectos.filter(p => p.compilable).map(p => p.nombre));

    if (await isFile(file)) {
        try {
            const config = await readJSON<IConfigServices>(file);
            salida.devel.disabled.push(...config?.devel?.disabled?.filter(actual => ejecutables.has(actual)) ?? []);
            salida.packd.disabled.push(...config?.packd?.disabled?.filter(actual => compilables.has(actual)) ?? []);
            salida.i18n = config.i18n??true;
            salida.services = config.services??{};
            salida.framework = {
                updates: sanitizeFrameworkUpdates(config.framework?.updates),
            };
            salida.patch = sanitizePatch(config.patch);
        } catch (e) {
            // no hacemos nada
        }
    }
    for (const proyecto of proyectos) {
        if (proyecto.ejecutable && !salida.devel.disabled.includes(proyecto.nombre)) {
            salida.devel.available.push(proyecto.nombre);
        }
        if (proyecto.compilable && !salida.packd.disabled.includes(proyecto.nombre)) {
            salida.packd.available.push(proyecto.nombre);
        }
    }

    salida.devel.available.sort(sort);
    salida.devel.available.push("");
    salida.devel.disabled.sort(sort);
    salida.devel.disabled.push("");
    salida.packd.available.sort(sort);
    salida.packd.available.push("");
    salida.packd.disabled.sort(sort);
    salida.packd.disabled.push("");

    await safeWrite(file, JSON.stringify(salida, null, 2), true);

    console.groupEnd();
}

/**
 * Verifica que `{basedir}/.github` sea un symlink (Unix) o junction (Windows)
 * apuntando a `@mr/core/dev/.github`.
 * Si existe pero no apunta al destino correcto (directorio real, fichero u otro
 * enlace), lo elimina y crea el enlace correcto. Si no existe, lo crea.
 *
 * En Windows se usa una *junction* porque no requiere permisos de administrador
 * ni tener activado el Developer Mode, al contrario que los symlinks de directorio.
 * Las junctions requieren ruta absoluta como destino.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
async function initGithub(basedir: string): Promise<void> {
    const githubPath = `${basedir}/.github`;
    const destinoRelativo = "@mr/core/dev/.github";
    const isWindows = process.platform === "win32";

    // Las junctions de Windows requieren ruta absoluta como destino.
    // En Unix el symlink relativo es suficiente y más portable.
    const destinoEfectivo = isWindows
        ? resolve(basedir, destinoRelativo)
        : destinoRelativo;

    const stat = await lstat(githubPath).catch(() => undefined);

    if (stat !== undefined) {
        // readlink funciona tanto para symlinks Unix como para junctions Windows.
        // lstat().isSymbolicLink() devuelve false en Windows para junctions,
        // por eso se usa readlink como detector universal de enlace.
        const actual = await readlink(githubPath).catch(() => undefined);
        if (actual === destinoEfectivo) return; // ya está correcto

        // Es un directorio real, fichero o enlace incorrecto — eliminar
        console.log(Colors.colorize([Colors.FgYellow], "Corrigiendo .github/ → symlink a @mr/core/dev/.github"));
        await unlink(githubPath);
    }

    // junction en Windows (no requiere permisos especiales)
    // symlink relativo estándar en Linux/macOS
    await symlink(destinoEfectivo, githubPath, isWindows ? "junction" : undefined);
}

/**
 * Verifica que `{basedir}/AGENTS.md` sea un symlink apuntando a
 * `@mr/core/dev/AGENTS.md`.
 *
 * Si existe pero no apunta al destino correcto (fichero real u otro enlace),
 * lo elimina y crea el enlace correcto. Si no existe, lo crea.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
async function initAgents(basedir: string): Promise<void> {
    const agentsPath = `${basedir}/AGENTS.md`;
    const destinoRelativo = "@mr/core/dev/AGENTS.md";
    const isWindows = process.platform === "win32";

    // En Windows forzamos ruta absoluta para evitar variaciones de resolución.
    const destinoEfectivo = isWindows
        ? resolve(basedir, destinoRelativo)
        : destinoRelativo;

    const stat = await lstat(agentsPath).catch(() => undefined);

    if (stat !== undefined) {
        const actual = await readlink(agentsPath).catch(() => undefined);
        if (actual === destinoEfectivo) {
            return;
        }

        console.log(Colors.colorize([Colors.FgYellow], "Corrigiendo AGENTS.md -> symlink a @mr/core/dev/AGENTS.md"));
        await unlink(agentsPath);
    }

    await symlink(destinoEfectivo, agentsPath);
}

async function initYarnRC(basedir: string): Promise<boolean> {
    console.log(Colors.colorize([Colors.FgWhite], "Inicializando configuración de YARN"));
    console.group();

    const filePath = `${basedir}/.yarnrc.yml`;
    const config = yamlLoad(await readFileString(filePath)) as IYarnRC;

    let cambio = false;

    // Asegurar campos requeridos
    if (config.approvedGitRepositories === undefined || config.approvedGitRepositories.length > 0) {
        config.approvedGitRepositories = [];
    }
    if (config.enableHardenedMode !== true) {
        config.enableHardenedMode = true;
        cambio = true;
    }
    if (config.checksumBehavior !== "throw") {
        config.checksumBehavior = "throw";
        cambio = true;
    }
    if (config.enableStrictSsl !== true) {
        config.enableStrictSsl = true;
        cambio = true;
    }
    if (config.npmMinimalAgeGate !== 1440) {
        config.npmMinimalAgeGate = 1440;
        cambio = true;
    }
    if (!config.unsafeHttpWhitelist || config.unsafeHttpWhitelist.length > 0) {
        config.unsafeHttpWhitelist = [];
        cambio = true;
    }

    // Librerías a añadir en packageExtensions (vacío por ahora)
    const libs: Record<string, string> = {};
    // Librerías obsoletas a eliminar de packageExtensions
    const exlibs = [
        "@google-cloud/opentelemetry-cloud-trace-exporter",
        "@google-cloud/opentelemetry-resource-util",
        "@inquirer/core",
        "mysql2",
    ];

    const extensions = {...(config.packageExtensions ?? {})};

    for (const [lib, dep] of Object.entries(libs).sort()) {
        const key = `${lib}@*`;
        if (extensions[key] === undefined) {
            extensions[key] = {dependencies: {[dep]: "*"}};
            cambio = true;
        }
    }

    for (const lib of exlibs) {
        const key = `${lib}@*`;
        if (key in extensions) {
            delete extensions[key];
            cambio = true;
        }
    }

    if (Object.keys(extensions).length > 0) {
        config.packageExtensions = extensions;
    } else {
        if (config.packageExtensions !== undefined) cambio = true;
        delete config.packageExtensions;
    }

    if (cambio) {
        const yaml = yamlDump(config, {lineWidth: -1, sortKeys: true})
            .replace(/^([a-zA-Z])/gm, "\n$1")
            .replace(/^\n/, "");
        await safeWrite(filePath, yaml, true);
    }

    console.groupEnd();

    return cambio;
}
