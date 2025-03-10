import {BuildFW} from "@mr/cli/manifest/build";
import {Manifest} from "@mr/cli/manifest";
import {Runtime} from "@mr/cli/manifest/deployment";
import {
    isDir,
    isFile,
    readDir,
    readFileString,
    readJSON, rename,
    safeWrite,
    unlink,
} from "services-comun/modules/utiles/fs";
import {md5 } from "services-comun/modules/utiles/hash";

import {Colors} from "./colors";
import {Comando} from "./comando";
import type {IManifestLegacy} from "./manifest/workspace/legacy";
import {type IPackageFW, PaqueteTipo} from "./paquete";
import type {IPackageJson as IPackageJsonBase} from "./packagejson";
import type {IConfigServices} from "./workspace/service";
import {Framework} from "./framework";
import {ManifestWorkspaceLoader} from "./manifest/workspace";
import {Yarn} from "./yarn";

import APP from "./init/app";
import ATTRIBUTES from "./init/attributes";
import DEVEL from "./init/devel";
import EDITORCONFIG from "./init/editorconfig";
import IGNORE from "./init/ignore";
import {ManifestRootLoader} from "./manifest/root";

interface IConfiguracion {
    openTelemetry: boolean;
    cambio: boolean;
}

export interface IPackageJson extends IPackageJsonBase {
    config?: IManifestLegacy;
}

interface IWorkspaces {
    dir: string;
    workspaces: string[];
}

export class Init {
    /* STATIC */
    public static async init(basedir: string): Promise<boolean> {
        console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Inicializando"));
        console.group();

        await this.checkCliente(basedir);
        const workspaces = await this.initBase(basedir);
        await this.deleteFiles(basedir);
        await this.limpiarLegacy(basedir);
        await this.corregirGITs(basedir);

        const config = await this.initWorkspaces(basedir, workspaces);
        await this.initConfig(basedir, workspaces);

        const cambio = await this.initYarnRC(basedir, config);

        if (await isDir(`${basedir}/i18n`)) {
            console.log(Colors.colorize([Colors.FgWhite], "Inicializando i18n"));
            const {status, stderr} = await Comando.spawn("yarn", ["mrlang", "init"], {cwd: basedir});
            if (status!=0) {
                console.error(stderr);
                console.groupEnd();
                return Promise.reject("Error al inicializar i18n");
            }
        }

        console.groupEnd();

        if(cambio || config.cambio) {
            await Yarn.install(basedir, {verbose:false});

            return true;
        }

        return false;
    }

    private static reduceConfig(configs: IConfiguracion[]): IConfiguracion {
        return configs.reduce((prev, actual)=>{
            return {
                openTelemetry: prev.openTelemetry || actual.openTelemetry,
                cambio: prev.cambio || actual.cambio,
            };
        }, {
            openTelemetry: false,
            cambio: false,
        });
    }

    private static async isValid(dir: string): Promise<boolean> {
        return await isDir(dir) && await isFile(`${dir}/package.json`)
    }

    protected static async checkCliente(basedir: string): Promise<void> {
        console.log(Colors.colorize([Colors.FgWhite], "Comprobando cliente"));
        console.group();

        await this.autocorregir(basedir);

        const hash = await Framework.checkCliente(basedir);
        if (hash!=undefined) {
            await Framework.recompilarCliente(basedir, hash);
        }

        console.groupEnd();
    }

    private static async initBase(basedir: string): Promise<IWorkspaces[]> {
        console.log(Colors.colorize([Colors.FgWhite], "Inicializando proyecto"));
        console.group();
        const cronjobs: string[] = [];
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
            "g:packd": "TS_NODE_PROJECT=\"config/tsconfig.json\" yarn workspace @mr/cli webpack --env entorno=desarrollo --env dir=\"$INIT_CWD\" --config \"config/webpack.config.ts\"",
            "update": "yarn mrpack update",
        };
        const bin = paquete.bin!=undefined;
        paquete.bin ??= {};
        paquete.bin["mrlang"] = "@mr/cli/bin/mrlang.js";
        paquete.bin["mrpack"] = "@mr/cli/bin/mrpack.js";

        if (await isDir(`${basedir}/framework`)) {
            for (const actual of await readDir(`${basedir}/framework`)) {
                if (await this.isValid(`${basedir}/framework/${actual}`)) {
                    paquete.scripts[actual] = `yarn workspace ${actual}`;
                } else {
                    await unlink(`${basedir}/framework/${actual}`);
                }
            }
        }

        if (await isDir(`${basedir}/cronjobs`)) {
            for (const actual of await readDir(`${basedir}/cronjobs`)) {
                if (await this.isValid(`${basedir}/cronjobs/${actual}`)) {
                    paquete.scripts[actual] = `yarn workspace ${actual}`;
                    cronjobs.push(actual);
                } else {
                    await unlink(`${basedir}/cronjobs/${actual}`);
                }
            }
        }

        if (await isDir(`${basedir}/services`)) {
            for (const actual of await readDir(`${basedir}/services`)) {
                if (await this.isValid(`${basedir}/services/${actual}`)) {
                    paquete.scripts[actual] = `yarn workspace ${actual}`;
                    services.push(actual);
                } else {
                    await unlink(`${basedir}/services/${actual}`);
                }
            }
        }

        if (await isDir(`${basedir}/packages`)) {
            for (const actual of await readDir(`${basedir}/packages`)) {
                if (await this.isValid(`${basedir}/packages/${actual}`)) {
                    paquete.scripts[actual] = `yarn workspace ${actual}`;
                } else {
                    await unlink(`${basedir}/packages/${actual}`);
                }
            }
        }

        if (await isDir(`${basedir}/scripts`)) {
            for (const actual of await readDir(`${basedir}/scripts`)) {
                if (await this.isValid(`${basedir}/scripts/${actual}`)) {
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
            "@mr/client/*",
            "cronjobs/*",
            "framework/*",
            "i18n",
            "packages/*",
            "scripts/*",
            "services/*",
            "statics/*",
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
        // paquete.resolutions["mysql2"] = "3.11.0";
        if (Object.keys(paquete.resolutions).length==0) {
            delete paquete.resolutions;
        }

        await safeWrite(`${basedir}/.editorconfig`, EDITORCONFIG, true);
        await safeWrite(`${basedir}/.gitattributes`, ATTRIBUTES, true);
        await safeWrite(`${basedir}/.gitignore`, IGNORE, true);
        await safeWrite(`${basedir}/.node-version`, "lts-latest\n", true);
        if (await isFile(`${basedir}/.sonarcloud.properties`)) {
            await unlink(`${basedir}/.sonarcloud.properties`);
        }
        await safeWrite(`${basedir}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);

        await this.checkRootManifest(basedir);

        if (!bin) {
            await Yarn.install(basedir, {verbose:false});
        }

        // todo inicializar el manifest de Root

        console.groupEnd();

        return [
            {
                dir: "cronjobs",
                workspaces: cronjobs,
            }, {
                dir: "services",
                workspaces: services,
            }, {
                dir: "scripts",
                workspaces: scripts,
            },
        ];
    }

    private static async checkRootManifest(basedir: string): Promise<void> {
        await new ManifestRootLoader(basedir).load();
    }

    private static async deleteFiles(basedir: string): Promise<void> {
        console.log(Colors.colorize([Colors.FgWhite], "Revisando archivos innecesarios"));
        console.group();
        for (const file of ["update.sh", "run.sh"]) {
            const item = `${basedir}/${file}`;
            if (await isFile(item) || await isDir(item)) {
                console.log(`Eliminando ${Colors.colorize([Colors.FgYellow], file)}`);
                await unlink(item);
            }
        }
        for (const file of ["status.json"]) {
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

    private static async corregirGITs(basedir: string): Promise<void> {
        console.log(Colors.colorize([Colors.FgWhite], "Corrigiendo conflictos de GIT"));
        console.group();

        await this.corregirGIT(basedir, "services-comun", "/", "CHANGELOG.md", ["changelog.md"]);

        console.groupEnd();
    }

    private static async corregirGIT(basedir: string, framework: string, subdir: string, bueno: string, malos: string[]): Promise<void> {
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
        if (malo==undefined) {
            // nada que corregir
            return;
        }

        console.log(`Corrigiendo ${Colors.colorize([Colors.FgYellow], `${framework}${subdir}${bueno}`)}`);

        // desactivamos el case-sensitive de git temporalmente
        {
            const {status, stderr} = await Comando.spawn("git", ["config", "core.ignorecase", "false"], {cwd: basedir});
            if (status != 0) {
                console.error("Error corrigiendo", framework, stderr);
                return;
            }
        }

        // eliminamos del repositorio el archivo con el nombre tanto correcto como incorrecto
        for (const file of [bueno, ...malos]) {
            await Comando.spawn("git", ["rm", "-r", "--cached", `framework/${framework}${subdir}${file}`], {cwd: basedir});
        }

        {
            const {status} = await Comando.spawn("git", ["commit", "-m", `"Corrigiendo archivos conflictivos"`], {cwd: basedir});
            if (status != 0) {
                // rehabilitamos el case-sensitive de git
                await Comando.spawn("git", ["config", "core.ignorecase", "true"], {cwd: basedir});
                return;
            }
        }

        // renombramos el archivo incorrecto al correcto
        await rename(`${dir}${malo}`, `${dir}${bueno}`);

        // rehabilitamos el case-sensitive de git
        await Comando.spawn("git", ["config", "core.ignorecase", "true"], {cwd: basedir});
    }

    private static async autocorregir(basedir: string): Promise<void> {
        const paquete = await readJSON<IPackageFW>(`${basedir}/@mr/cli/package.json`);
        if (paquete.config==undefined || paquete.config.bucket==undefined || paquete.config.tipo==undefined) {
            console.log(Colors.colorize([Colors.FgYellow], "Autocorrigiendo posibles errores"));
            paquete.config = {
                bucket: "meteored-yarn-packages",
                subible: true,
                tipo: PaqueteTipo.root,
            };
            await safeWrite(`${basedir}/@mr/cli/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
        }
    }

    private static async limpiarLegacy(basedir: string): Promise<void> {
        console.log(Colors.colorize([Colors.FgWhite], "Limpiando frameworks legacy"));
        console.group();

        await this.limpiarLegacyEjecutar(basedir, "services-comun", ["tools"]);

        console.groupEnd();
    }

    private static async limpiarLegacyEjecutar(basedir: string, framework: string, items: string[]): Promise<void> {
        for (const item of items) {
            const dir = `${basedir}/framework/${framework}/${item}`;
            if (await isFile(dir) || await isDir(dir)) {
                console.log(`Limpiando ${Colors.colorize([Colors.FgYellow], `${framework}/${item}`)}`);
                await unlink(dir);
            }
        }
    }

    private static async loadConfig(basedir: string): Promise<{paquete: IPackageJson, config: Manifest}> {
        const paquete = await readJSON<IPackageJson>(`${basedir}/package.json`);
        let config: ManifestWorkspaceLoader;
        if (paquete.config!=undefined) {
            config = new ManifestWorkspaceLoader(basedir).fromLegacy(paquete.config);
            await config.save();
            delete paquete.config;
            await safeWrite(`${basedir}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
        } else {
            config = await new ManifestWorkspaceLoader(basedir).load();
        }

        return {paquete, config: config.manifest};
    }

    private static checkScripts(config: Manifest, scripts: Record<string, string>): void {
        switch(config.build.framework) {
            case BuildFW.meteored:
                switch(config.deploy.runtime) {
                    case Runtime.cfworker:
                        scripts["packd"] = `yarn tsc --noemit --watch`;
                        scripts["devel"] = "wrangler dev --remote --env test";
                        break;
                    case Runtime.node:
                        scripts["packd"] = `yarn g:packd`;
                        if (!config.deploy.cronjob) {
                            scripts["devel"] = "yarn g:devel";
                        } else {
                            scripts["devel"] = "yarn node --no-warnings devel.js";
                        }
                        break;
                    default:
                        scripts["packd"] = `yarn g:packd`;
                        break;
                }
                break;

            case BuildFW.nextjs:
                scripts["dev"] ??= "yarn run next dev -- -p 8080";
                break;
        }
    }

    private static checkDependencies(config: Manifest, dependencies: Record<string, string>, devDependencies: Record<string, string>, defecto: Record<string, string>): boolean {
        let openTelemetry = false;
        if (devDependencies["tslib"]!=undefined) {
            dependencies["tslib"] = devDependencies["tslib"];
            delete devDependencies["tslib"];
        } else if (dependencies["tslib"]==undefined) {
            dependencies["tslib"] = "*";
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
                dependencies["@google-cloud/opentelemetry-cloud-trace-exporter"] ??= defecto["@google-cloud/opentelemetry-cloud-trace-exporter"]??"*";
                dependencies["@opentelemetry/api"] ??= defecto["@opentelemetry/api"]??"*";
                dependencies["@opentelemetry/core"] ??= defecto["@opentelemetry/core"]??"*";
                dependencies["@opentelemetry/instrumentation"] ??= defecto["@opentelemetry/instrumentation"]??"*";
                dependencies["@opentelemetry/instrumentation-http"] ??= defecto["@opentelemetry/instrumentation-http"]??"*";
                dependencies["@opentelemetry/resources"] ??= defecto["@opentelemetry/resources"]??"*";
                dependencies["@opentelemetry/sdk-trace-base"] ??= defecto["@opentelemetry/sdk-trace-base"]??"*";
                dependencies["@opentelemetry/sdk-trace-node"] ??= defecto["@opentelemetry/sdk-trace-node"]??"*";
                dependencies["@opentelemetry/semantic-conventions"] ??= defecto["@opentelemetry/semantic-conventions"]??"*";
                dependencies["chokidar"] ??= defecto["chokidar"]??"*";
                dependencies["hexoid"] ??= defecto["hexoid"]??"*";
                devDependencies["formidable"] ??= defecto["formidable"]??"*";

                if (dependencies["@google-cloud/trace-agent"] != undefined) {
                    delete dependencies["@google-cloud/trace-agent"];
                }
                if (dependencies["@opentelemetry/context-async-hooks"] != undefined) {
                    delete dependencies["@opentelemetry/context-async-hooks"];
                }
                if (dependencies["formidable"] != undefined) {
                    delete dependencies["formidable"];
                }

                openTelemetry = true;
            }

            if (devDependencies["source-map-support"] != undefined) {
                delete devDependencies["source-map-support"];
            }
        }

        return openTelemetry;
    }

    public static async checkFiles(config: Manifest, basedir: string): Promise<void> {
        if (config.deploy.runtime==Runtime.node && config.build.framework!=BuildFW.nextjs) {
            await Promise.all([
                safeWrite(`${basedir}/app.js`, APP, true),
                safeWrite(`${basedir}/devel.js`, DEVEL, true),
                safeWrite(`${basedir}/init.js`, ``, false),
            ]);
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
            if (!contenido.includes("COPY ./${RUTA}/${WS}/mrpack.json ./${RUTA}/${WS}")) {
                contenido = contenido.replace("COPY ./${RUTA}/${WS}/package.json ./${RUTA}/${WS}", "COPY ./${RUTA}/${WS}/mrpack.json ./${RUTA}/${WS}\nCOPY ./${RUTA}/${WS}/package.json ./${RUTA}/${WS}");
                cambio = true;
            }
            if (cambio) {
                console.log(Colors.colorize([Colors.FgYellow], `Corrigiendo ${basedir}/Dockerfile`));
                await safeWrite(`${basedir}/Dockerfile`, contenido, true);
            }
        }
    }

    private static async initWorkspace(basedir: string, dependenciesDefecto: Record<string, string>): Promise<IConfiguracion> {
        const salida: IConfiguracion = {
            openTelemetry: false,
            cambio: false,
        };

        const {paquete, config} = await this.loadConfig(basedir);
        const hash = md5(JSON.stringify(paquete));
        if (config.enabled) {
            paquete.version = "0000.00.00-000";
            this.checkScripts(config, paquete.scripts ??= {});

            if (config.deploy.runtime==Runtime.node) {
                salida.openTelemetry = this.checkDependencies(config, paquete.dependencies??={}, paquete.devDependencies??={}, dependenciesDefecto);
                if (Object.keys(paquete.dependencies).length==0) {
                    delete paquete.dependencies;
                }
                if (Object.keys(paquete.devDependencies).length==0) {
                    delete paquete.devDependencies;
                }
            }

            await safeWrite(`${basedir}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
        }

        await this.checkFiles(config, `${basedir}`);

        salida.cambio = hash!=md5(JSON.stringify(paquete));

        return salida;
    }

    private static async initWorkspaces(basedir: string, workspaces: IWorkspaces[]): Promise<IConfiguracion> {
        console.log(Colors.colorize([Colors.FgWhite], "Inicializando workspaces"));
        console.group();

        const {devDependencies: paquetePropio={}} = await readJSON<IPackageJsonBase>(`${basedir}/framework/services-comun/package.json`);

        const promesas: Promise<IConfiguracion>[] = [];
        for (const carpeta of workspaces) {
            for (const workspace of carpeta.workspaces) {
                promesas.push(this.initWorkspace(`${basedir}/${carpeta.dir}/${workspace}`, paquetePropio));
            }
        }

        const config = this.reduceConfig(await Promise.all(promesas));

        console.groupEnd();
        return config;
    }

    private static async initConfig(basedir: string, workspaces: IWorkspaces[]): Promise<void> {
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
        };

        const proyectos: string[] = [];
        for (const carpeta of workspaces) {
            proyectos.push(...carpeta.workspaces);
        }

        if (await isFile(file)) {
            try {
                const config = await readJSON<IConfigServices>(file);
                salida.devel.disabled.push(...config?.devel?.disabled?.filter(actual=>proyectos.includes(actual))??[]);
                salida.packd.disabled.push(...config?.packd?.disabled?.filter(actual=>proyectos.includes(actual))??[]);
                salida.i18n = config.i18n??true;
                salida.services = config.services??{};
            } catch (e) {

            }
        }
        for (const actual of proyectos) {
            if (!salida.devel.disabled.includes(actual)) {
                salida.devel.available.push(actual);
            }
            if (!salida.packd.disabled.includes(actual)) {
                salida.packd.available.push(actual);
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

    private static async initYarnRC(basedir: string, config: IConfiguracion): Promise<boolean> {
        // if (!config.openTelemetry) {
        //     return;
        // }
        console.log(Colors.colorize([Colors.FgWhite], "Inicializando configuración de YARN"));
        console.group();

        const file = await readFileString(`${basedir}/.yarnrc.yml`);
        const lineas = file.split("\n");
        const anteriores: string[] = [];
        let corrientes: string[] = [];
        const posteriores: string[] = [];

        let paso: number = 0;
        for (const linea of lineas) {
            if (linea=="packageExtensions:") {
                paso = 1;
            } else if (linea=="plugins:" || linea.startsWith("yarnPath:")) {
                paso = 2;
            }
            switch(paso) {
                case 0:
                    anteriores.push(linea.trimEnd());
                    break;
                case 1:
                    corrientes.push(linea.trimEnd());
                    break;
                case 2:
                    posteriores.push(linea.trimEnd());
                    break;
            }
        }

        let cambio = false;
        // let nuevo = false;
        corrientes = corrientes.filter(actual=>actual.length>0);
        if (corrientes.length==0) {
            corrientes.push("packageExtensions:");
            // nuevo = true;
        }

        const libs: NodeJS.Dict<string> = {};
        const exlibs = [
            "@inquirer/core",
            "mysql2"
        ];

        if (config.openTelemetry) {
            libs["@google-cloud/opentelemetry-cloud-trace-exporter"] = "@opentelemetry/semantic-conventions";
            libs["@google-cloud/opentelemetry-resource-util"] = "@opentelemetry/api";
        }

        for (const lib of Object.keys(libs).sort()) {
            if (!corrientes.includes(`  "${lib}@*":`)) {
                const dep = libs[lib];
                corrientes.push(`  "${lib}@*":`);
                corrientes.push(`    dependencies:`);
                corrientes.push(`      "${dep}": "*"`);
                cambio = true;
            }
        }

        for (const cadena of exlibs) {
            const idx = corrientes.indexOf(`  ${cadena}@*:`);
            if (idx >= 0) {
                corrientes.splice(idx, 3);
                cambio = true;
            }
        }

        corrientes = corrientes.filter(actual=>actual.length>0);
        if (corrientes.length==1) {
            corrientes = [];
            cambio = true;
        }

        if (cambio) {
            if (corrientes.length>0) {
                corrientes.push("");
            }
            await safeWrite(`${basedir}/.yarnrc.yml`, [...anteriores, ...corrientes, ...posteriores].join("\n"), true);
        }

        console.groupEnd();

        return cambio;
    }

    /* INSTANCE */
}
