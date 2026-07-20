/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 17 Jul 2026 12:09:53 GMT
 * Hash: 47c578b8d6d7c66bf7a8be021d32e517
 * Versión: 2026.7.17+3-josantoniojimnez
 * Anterior: 2026.7.17+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {md5} from "services-comun/modules/utiles/hash";

import {BuildFW} from "@mr/core-dev/manifest/build";
import type {Manifest} from "@mr/core-dev/manifest";
import {Runtime} from "@mr/core-dev/manifest/deployment";

import {isDir, isFile, readDir, readFileString, readJSON, safeWrite, unlink} from "../../utiles/fs";
import {Colors} from "./colors";
import {Comando} from "./comando";
import {Log} from "./log";
import type {IManifestLegacy} from "./manifest/workspace/legacy";
import {type IPackageFW, PaqueteTipo} from "./paquete";
import type {IPackageJson as IPackageJsonBase, IPackageJsonLegacy} from "./packagejson";
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
import {checkDependencies, resolverDepsTransitivas, versionMasReciente} from "./init/dependencias";
import {getBundlerNormalizado} from "./bundler";
import {checkScripts} from "./init/scripts";
import {corregirGITs} from "./init/git";
import {limpiarLegacy} from "./init/legacy";
import {initGithub, initAgents, initClaude, initClaudeDir} from "./init/symlinks";
import {initYarnRC} from "./init/yarnrc";
import {initConfig, type IWorkspaces} from "./init/config-workspaces";
import {initRun} from "./init/run";

interface IConfiguracion {
    // openTelemetry: boolean;
    cambio: boolean;
}

export interface IPackageJson extends IPackageJsonBase {
    config?: IManifestLegacy;
}

export async function init(basedir: string): Promise<boolean> {
    Log.group({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgCyan, Colors.Bright], "Inicializando"));

    await checkCliente(basedir);
    const workspaces = await initBase(basedir);
    await deleteFiles(basedir);
    await limpiarLegacy(basedir);
    await corregirGITs(basedir);

    const config = await initWorkspaces(basedir, workspaces);
    await initConfig(basedir, workspaces);
    await initRun(basedir, workspaces);

    const cambio = await initYarnRC(basedir/*, config*/);

    await initGithub(basedir);
    await initAgents(basedir);
    await initClaude(basedir);
    await initClaudeDir(basedir);

    if (await isDir(`${basedir}/i18n`)) {
        Log.info({type: Log.label_base, label: "i18n"}, Colors.colorize([Colors.FgWhite], "Inicializando i18n"));
        const {status, stderr} = await Comando("yarn", ["mrlang", "init"], {cwd: basedir});
        if (status!=0) {
            Log.error({type: Log.label_base, label: "i18n"}, stderr);
            Log.groupEnd();
            return Promise.reject(new Error("Error al inicializar i18n"));
        }
    }

    Log.groupEnd();

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
        Log.info({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/init.js`));
        await unlink(`${basedir}/init.js`);
    }

    if (await isFile(`${basedir}/output/.foreverignore`)) {
        Log.info({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/output/.foreverignore`));
        await unlink(`${basedir}/output/.foreverignore`);
    }
    if (await isFile(`${basedir}/output/devel.js`)) {
        Log.info({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/output/devel.js`));
        await unlink(`${basedir}/output/devel.js`);
    }
    if (await isFile(`${basedir}/output/devel.js.map`)) {
        Log.info({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/output/devel.js.map`));
        await unlink(`${basedir}/output/devel.js.map`);
    }
    if (await isFile(`${basedir}/pack.js`)) {
        Log.info({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/pack.js`));
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
            Log.info({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgYellow], `Corrigiendo ${basedir}/Dockerfile`));
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
    Log.group({type: Log.label_base, label: "cliente"}, Colors.colorize([Colors.FgWhite], `Comprobando cliente`));

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

    Log.groupEnd();
}

async function initBase(basedir: string): Promise<IWorkspaces[]> {
    Log.group({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgWhite], "Inicializando proyecto"));
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

    Log.groupEnd();

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
    Log.group({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgWhite], "Revisando archivos innecesarios"));
    for (const file of ["update.sh", "run.sh"]) {
        const item = `${basedir}/${file}`;
        if (await isFile(item) || await isDir(item)) {
            Log.info({type: Log.label_base, label: "init"}, `Eliminando ${Colors.colorize([Colors.FgYellow], file)}`);
            await unlink(item);
        }
    }
    for (const file of ["status.json", "bin/mrdev.js"]) {
        const item = `${basedir}/@mr/cli/${file}`;
        if (await isFile(item) || await isDir(item)) {
            Log.info({type: Log.label_base, label: "init"}, `Eliminando ${Colors.colorize([Colors.FgYellow], `@mr/cli/${file}`)}`);
            await unlink(item);
        }
    }
    for (const actual of await readDir(`${basedir}/framework`)) {
        for (const file of ["download.js", "status.json", "upload.js", "files"]) {
            const item = `${basedir}/framework/${actual}/${file}`;
            if (await isFile(item) || await isDir(item)) {
                Log.info({type: Log.label_base, label: "init"}, `Eliminando ${Colors.colorize([Colors.FgYellow], `${actual}/${file}`)}`);
                await unlink(item);
            }
        }
    }

    Log.groupEnd();
}

async function autocorregir(basedir: string): Promise<void> {
    const paquete = await readJSON<IPackageFW>(`${basedir}/@mr/cli/package.json`);
    if (paquete.config===undefined || paquete.config.bucket===undefined || paquete.config.tipo===undefined) {
        Log.info({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgYellow], "Autocorrigiendo posibles errores"));
        paquete.config = {
            bucket: "meteored-yarn-packages",
            subible: true,
            tipo: PaqueteTipo.root,
        };
        await safeWrite(`${basedir}/@mr/cli/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
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
    Log.group({type: Log.label_base, label: "workspaces"}, Colors.colorize([Colors.FgWhite], "Inicializando workspaces"));

    const {devDependencies: paquetePropio={}} = await readJSON<IPackageJsonBase>(`${basedir}/framework/services-comun/package.json`);

    const promesas: Promise<IConfiguracion>[] = [];
    for (const carpeta of workspaces) {
        for (const workspace of carpeta.workspaces) {
            promesas.push(initWorkspace(`${basedir}/${carpeta.dir}/${workspace}`, basedir, paquetePropio));
        }
    }

    const config = reduceConfig(await Promise.all(promesas));

    Log.groupEnd();
    return config;
}
