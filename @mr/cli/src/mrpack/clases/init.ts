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
import {IPackageFW, PaqueteTipo} from "./paquete";
import {EFramework, ERuntime, type IConfigService, type IConfigServices} from "./workspace/service";
import {Framework} from "./framework";
import type {IPackageJson} from "./service";
import {Yarn} from "./yarn";

// import APP_DEPLOYMENT from "./init/app-deployment";
import APP from "./init/app";
import ATTRIBUTES from "./init/attributes";
import DEVEL from "./init/devel";
import IGNORE from "./init/ignore";
import SONARLINT from "./init/sonarlint";

interface IConfiguracion {
    openTelemetry: boolean;
    cambio: boolean;
}

// interface IModuloTraduccion {
//     [modulo: string]: {
//         include?: string[];
//         exclude?: string[];
//     };
// }

export class Init {
    /* STATIC */
    public static async init(basedir: string): Promise<boolean> {
        console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Inicializando"));
        console.group();

        await this.checkCliente(basedir);
        const [cronjobs, services, scripts] = await this.initBase(basedir);
        await this.deleteFiles(basedir);
        await this.limpiarLegacy(basedir);
        await this.corregirGITs(basedir);
        const config = this.reduceConfig([
            await this.initCronjobs(basedir, cronjobs),
            await this.initServices(basedir, services),
            await this.initScripts(basedir, scripts),
        ]);

        await this.initConfig(basedir, cronjobs, services);
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

    private static async initBase(basedir: string): Promise<[string[], string[], string[]]> {
        console.log(Colors.colorize([Colors.FgWhite], "Inicializando proyecto"));
        console.group();
        const cronjobs: string[] = [];
        const services: string[] = [];
        const scripts: string[] = [];

        const paquete = await readJSON<IPackageJson>(`${basedir}/package.json`);
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
        paquete.resolutions["mysql2"] = "3.11.0";

        await safeWrite(`${basedir}/.gitattributes`, ATTRIBUTES, true);
        await safeWrite(`${basedir}/.gitignore`, IGNORE, true);
        await safeWrite(`${basedir}/.node-version`, "lts-latest\n", true);
        await safeWrite(`${basedir}/.sonarcloud.properties`, SONARLINT, true);
        await safeWrite(`${basedir}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);

        // if (await isDir(`${basedir}/statics/translation`)) {
        //     await this.migrarTraducciones(basedir);
        //     paquete.scripts["i18n"] = "yarn workspace i18n";
        //     await safeWrite(`${basedir}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
        // }

        if (!bin) {
            await Yarn.install(basedir, {verbose:false});
        }

        console.groupEnd();
        return [cronjobs, services, scripts];
    }

    // private static async migrarTraducciones(basedir: string): Promise<void> {
    //     console.log(Colors.colorize([Colors.FgYellow], "Migrando traducciones"));
    //     const {status, stdout, stderr} = await Comando.spawn("yarn", ["workspace", "services-comun", "mrlang", "init"], {cwd: basedir});
    //     console.log(stdout);
    //     console.error(stderr);
    //     if (status!=0) {
    //         return Promise.reject("Error al migrar traducciones");
    //     }
    //
    //     if (await isDir(`${basedir}/statics`)) {
    //         for (const workspace of await readDir(`${basedir}/statics`)) {
    //             const json = `${basedir}/statics/${workspace}/json`;
    //             if (await isDir(json)) {
    //                 for (const modulo of await readDir(json)) {
    //                     if (await isDir(`${json}/${modulo}`)) {
    //                         await rename(`${json}/${modulo}`, `${basedir}/i18n/.json/${modulo}`);
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //
    //     console.log(Colors.colorize([Colors.FgGreen], "Actualizando /i18n/package.json"));
    //     const paquete = await readJSON<{ config: IPackageConfig }>(`${basedir}/i18n/package.json`).catch(()=>({config: {langs: soportados, modulos: {}}}));
    //     await this.parseModulosTraduccion(paquete.config.modulos, `${basedir}/i18n/.json`);
    //     await safeWrite(`${basedir}/i18n/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
    //
    //     console.log(Colors.colorize([Colors.FgGreen], "Borrando directorios antiguos"));
    //     await rmdir(`${basedir}/statics`);
    //     if (await isDir(`${basedir}/framework/services-translation`)) {
    //         await rmdir(`${basedir}/framework/services-translation`);
    //     }
    //
    //     await Yarn.install(basedir, {optimize: false});
    // }

    // private static async parseModulosTraduccion(modulos: IModuloTraduccion, basedir: string, padre?: string): Promise<void> {
    //     const files = await readDir(basedir);
    //     for (const file of files) {
    //         if (!await isDir(`${basedir}/${file}`)) {
    //             continue;
    //         }
    //
    //         const id = padre?`${padre}.${file}`:file;
    //         let include: string[]|undefined;
    //         let exclude: string[];
    //         if (await isFile(`${basedir}/${file}/include.json`)) {
    //             include = await readJSON<string[]>(`${basedir}/${file}/include.json`);
    //             await rmdir(`${basedir}/${file}/include.json`);
    //         }
    //         if (await isFile(`${basedir}/${file}/exclude.json`)) {
    //             exclude = await readJSON<string[]>(`${basedir}/${file}/exclude.json`);
    //             await rmdir(`${basedir}/${file}/exclude.json`);
    //         } else {
    //             exclude = [];
    //         }
    //         modulos[id] = {
    //             include,
    //             exclude,
    //         };
    //
    //         await this.parseModulosTraduccion(modulos, `${basedir}/${file}`, id);
    //     }
    // }

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

    private static async initServices(basedir: string, workspaces: string[]): Promise<IConfiguracion> {
        console.log(Colors.colorize([Colors.FgWhite], "Inicializando servicios"));
        console.group();

        const config = this.reduceConfig(await Promise.all(workspaces.map(workspace=>this.initService(basedir, workspace))));

        console.groupEnd();
        return config;
    }

    private static async initService(basedir: string, workspace: string): Promise<IConfiguracion> {
        const salida: IConfiguracion = {
            openTelemetry: false,
            cambio: false,
        };

        const {devDependencies: paquetePropio={}} = await readJSON<IPackageJson>(`${basedir}/framework/services-comun/package.json`);
        const paquete = await readJSON(`${basedir}/services/${workspace}/package.json`);
        const hash = md5(JSON.stringify(paquete));
        paquete.config ??= {};
        if (paquete.config.nextjs!==undefined && typeof paquete.config.nextjs!=="object") {
            paquete.config.nextjs = {};
        }
        const nextjs = paquete.config.nextjs ?? {};
        const resources = paquete.config.resources??paquete.resources??false;

        const config: Partial<IConfigService> = {};
        config.cronjob = paquete.config.cronjob??paquete.cronjob??false;
        config.devel = paquete.config.devel??paquete.devel??true;
        config.deploy = paquete.config.deploy??true;
        config.generar = paquete.config.generar??paquete.generar??false;
        config.imagen = paquete.config.imagen;//??"node:lts-alpine";
        config.unico = paquete.config.unico??paquete.unico??false;

        config.deps = paquete.config.deps??[];
        const storage = paquete.config.storage??paquete.storage;
        if (Array.isArray(storage)) {
            if (storage.length>0) {
                config.storage = {
                    buckets: storage,
                };
            }
        } else {
            config.storage = paquete.config.storage;
        }

        config.runtime = paquete.config.runtime??(!resources?ERuntime.node:ERuntime.browser);
        if (paquete.config.framework!==undefined) {
            config.framework = paquete.config.framework;
        } else if (!nextjs.enabled) {
            config.framework = EFramework.meteored;
        } else {
            config.framework = EFramework.nextjs;
        }
        config.kustomize = paquete.config.kustomize??"services";
        if (paquete.config.credenciales!==undefined) {
            config.credenciales = paquete.config.credenciales;
        } else {
            config.credenciales = nextjs.credenciales??[];
        }
        config.database = paquete.config.database;
        config.bundle = paquete.config.bundle??{};

        paquete.config = config;

        if (paquete.nodemonConfig!=undefined) {
            delete paquete.nodemonConfig;
        }

        if (paquete.config.generar) {
            paquete.scripts ??= {};
            switch(paquete.config.framework) {
                case EFramework.meteored:
                    switch(config.runtime) {
                        case ERuntime.cfworker:
                            paquete.scripts.packd = `yarn tsc --noemit --watch`;
                            paquete.scripts.devel = "wrangler dev --remote --env test";
                            break;
                        case ERuntime.node:
                            paquete.scripts.packd = `yarn g:packd`;
                            if (!paquete.config.cronjob) {
                                paquete.scripts.devel = "yarn g:devel";
                            } else {
                                paquete.scripts.devel = "yarn node --no-warnings devel.js";
                            }
                            paquete.version = "0000.00.00-000";
                            break;
                        default:
                            paquete.scripts.packd = `yarn g:packd`;
                            break;
                    }
                    break;

                // case EFramework.astro:
                //     paquete.scripts.build ??= "astro build";
                //     paquete.scripts.dev ??= "astro dev";
                //     paquete.scripts.preview ??= "astro preview";
                //     paquete.scripts.start ??= "astro start";
                //     break;

                case EFramework.nextjs:
                    paquete.scripts.dev ??= "yarn run next dev -- -p 8080";
                    break;
            }

            if (config.runtime==ERuntime.node) {
                paquete.dependencies??={};
                paquete.devDependencies??={};

                if (paquete.devDependencies["tslib"]!=undefined) {
                    paquete.dependencies["tslib"] = paquete.devDependencies["tslib"];
                    delete paquete.devDependencies["tslib"];
                } else if (paquete.dependencies["tslib"]==undefined) {
                    paquete.dependencies["tslib"] = "*";
                }

                if (config.framework!=EFramework.nextjs) {
                    // const hash=`${md5(JSON.stringify(paquete.dependencies))}${md5(JSON.stringify(paquete.devDependencies))}`;

                    paquete.dependencies["source-map-support"] ??= paquetePropio["source-map-support"]??"*";

                    for (const [lib, version] of Object.entries(paquetePropio)) {
                        if (paquete.dependencies[lib]!=undefined) {
                            paquete.dependencies[lib] = version;
                        }
                        if (paquete.devDependencies[lib]!=undefined) {
                            paquete.devDependencies[lib] = version;
                        }
                    }
                    if (!config.cronjob) {
                        paquete.dependencies["@google-cloud/opentelemetry-cloud-trace-exporter"] ??= paquetePropio["@google-cloud/opentelemetry-cloud-trace-exporter"]??"*";
                        paquete.dependencies["@opentelemetry/api"] ??= paquetePropio["@opentelemetry/api"]??"*";
                        paquete.dependencies["@opentelemetry/core"] ??= paquetePropio["@opentelemetry/core"]??"*";
                        paquete.dependencies["@opentelemetry/instrumentation"] ??= paquetePropio["@opentelemetry/instrumentation"]??"*";
                        paquete.dependencies["@opentelemetry/instrumentation-http"] ??= paquetePropio["@opentelemetry/instrumentation-http"]??"*";
                        paquete.dependencies["@opentelemetry/resources"] ??= paquetePropio["@opentelemetry/resources"]??"*";
                        paquete.dependencies["@opentelemetry/sdk-trace-base"] ??= paquetePropio["@opentelemetry/sdk-trace-base"]??"*";
                        paquete.dependencies["@opentelemetry/sdk-trace-node"] ??= paquetePropio["@opentelemetry/sdk-trace-node"]??"*";
                        paquete.dependencies["@opentelemetry/semantic-conventions"] ??= paquetePropio["@opentelemetry/semantic-conventions"]??"*";
                        paquete.dependencies["chokidar"] ??= paquetePropio["chokidar"]??"*";
                        paquete.dependencies["hexoid"] ??= paquetePropio["hexoid"]??"*";
                        paquete.devDependencies["formidable"] ??= paquetePropio["formidable"]??"*";

                        if (paquete.dependencies["@google-cloud/trace-agent"] !== undefined) {
                            delete paquete.dependencies["@google-cloud/trace-agent"];
                        }
                        if (paquete.dependencies["@opentelemetry/context-async-hooks"] !== undefined) {
                            delete paquete.dependencies["@opentelemetry/context-async-hooks"];
                        }
                        if (paquete.dependencies["formidable"] !== undefined) {
                            delete paquete.dependencies["formidable"];
                        }

                        salida.openTelemetry = true;
                    }

                    if (paquete.devDependencies["source-map-support"]!==undefined) {
                        delete paquete.devDependencies["source-map-support"];
                    }

                    if (Object.keys(paquete.dependencies).length==0) {
                        delete paquete.dependencies;
                    }
                    if (Object.keys(paquete.devDependencies).length==0) {
                        delete paquete.devDependencies;
                    }
                }
            }

            await safeWrite(`${basedir}/services/${workspace}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
        }

        if (config.runtime==ERuntime.node && config.framework!=EFramework.nextjs) {
            await Promise.all([
                safeWrite(`${basedir}/services/${workspace}/app.js`, APP, true),
                safeWrite(`${basedir}/services/${workspace}/devel.js`, DEVEL, true),
                safeWrite(`${basedir}/services/${workspace}/init.js`, ``, false),
            ]);
        }

        if (await isFile(`${basedir}/services/${workspace}/output/.foreverignore`)) {
            console.log(Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/services/${workspace}/output/.foreverignore`));
            await unlink(`${basedir}/services/${workspace}/output/.foreverignore`);
        }
        if (await isFile(`${basedir}/services/${workspace}/output/devel.js`)) {
            console.log(Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/services/${workspace}/output/devel.js`));
            await unlink(`${basedir}/services/${workspace}/output/devel.js`);
        }
        if (await isFile(`${basedir}/services/${workspace}/output/devel.js.map`)) {
            console.log(Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/services/${workspace}/output/devel.js.map`));
            await unlink(`${basedir}/services/${workspace}/output/devel.js.map`);
        }
        if (await isFile(`${basedir}/services/${workspace}/pack.js`)) {
            console.log(Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/services/${workspace}/pack.js`));
            await unlink(`${basedir}/services/${workspace}/pack.js`);
        }

        salida.cambio = hash!=md5(JSON.stringify(paquete));

        return salida;
    }

    private static async initCronjobs(basedir: string, workspaces: string[]): Promise<IConfiguracion> {
        console.log(Colors.colorize([Colors.FgWhite], "Inicializando cronjobs"));
        console.group();

        const config = this.reduceConfig(await Promise.all(workspaces.map(workspace=>this.initCronjob(basedir, workspace))));

        console.groupEnd();
        return config;
    }

    private static async initCronjob(basedir: string, workspace: string): Promise<IConfiguracion> {
        const salida: IConfiguracion = {
            openTelemetry: false,
            cambio: false,
        };

        const {devDependencies: paquetePropio={}} = await readJSON<IPackageJson>(`${basedir}/framework/services-comun/package.json`);
        const paquete = await readJSON(`${basedir}/cronjobs/${workspace}/package.json`);
        const hash = md5(JSON.stringify(paquete));
        paquete.config ??= {};
        if (paquete.config.nextjs!==undefined && typeof paquete.config.nextjs!=="object") {
            paquete.config.nextjs = {};
        }
        const nextjs = paquete.config.nextjs ?? {};
        const resources = paquete.config.resources??paquete.resources??false;

        const config: Partial<IConfigService> = {};
        config.cronjob = paquete.config.cronjob??paquete.cronjob??true;
        config.devel = paquete.config.devel??paquete.devel??true;
        config.deploy = paquete.config.deploy??true;
        config.generar = paquete.config.generar??paquete.generar??false;
        config.imagen = paquete.config.imagen;//??"node:lts-alpine";
        config.unico = paquete.config.unico??paquete.unico??false;

        config.deps = paquete.config.deps??[];
        const storage = paquete.config.storage??paquete.storage;
        if (Array.isArray(storage)) {
            if (storage.length>0) {
                config.storage = {
                    buckets: storage,
                };
            }
        } else {
            config.storage = paquete.config.storage;
        }

        config.runtime = paquete.config.runtime??(!resources?ERuntime.node:ERuntime.browser);
        if (paquete.config.framework!==undefined) {
            config.framework = paquete.config.framework;
        } else if (!nextjs.enabled) {
            config.framework = EFramework.meteored;
        } else {
            config.framework = EFramework.nextjs;
        }
        config.kustomize = paquete.config.kustomize??"services";
        if (paquete.config.credenciales!==undefined) {
            config.credenciales = paquete.config.credenciales;
        } else {
            config.credenciales = nextjs.credenciales??[];
        }
        config.database = paquete.config.database;
        config.bundle = paquete.config.bundle??{};

        paquete.config = config;

        if (paquete.nodemonConfig!=undefined) {
            delete paquete.nodemonConfig;
        }

        if (paquete.config.generar) {
            paquete.scripts ??= {};
            switch(paquete.config.framework) {
                case EFramework.meteored:
                    switch(config.runtime) {
                        case ERuntime.cfworker:
                            paquete.scripts.packd = `yarn tsc --noemit --watch`;
                            paquete.scripts.devel = "wrangler dev --remote --env test";
                            break;
                        case ERuntime.node:
                            paquete.scripts.packd = `yarn g:packd`;
                            if (!paquete.config.cronjob) {
                                paquete.scripts.devel = "yarn g:devel";
                            } else {
                                paquete.scripts.devel = "yarn node --no-warnings devel.js";
                            }
                            paquete.version = "0000.00.00-000";
                            break;
                        default:
                            paquete.scripts.packd = `yarn g:packd`;
                            break;
                    }
                    break;

                // case EFramework.astro:
                //     paquete.scripts.build ??= "astro build";
                //     paquete.scripts.dev ??= "astro dev";
                //     paquete.scripts.preview ??= "astro preview";
                //     paquete.scripts.start ??= "astro start";
                //     break;

                case EFramework.nextjs:
                    paquete.scripts.dev ??= "yarn run next dev -- -p 8080";
                    break;
            }

            if (config.runtime==ERuntime.node) {
                paquete.dependencies??={};
                paquete.devDependencies??={};

                if (paquete.devDependencies["tslib"]!=undefined) {
                    paquete.dependencies["tslib"] = paquete.devDependencies["tslib"];
                    delete paquete.devDependencies["tslib"];
                } else if (paquete.dependencies["tslib"]==undefined) {
                    paquete.dependencies["tslib"] = "*";
                }

                if (config.framework!=EFramework.nextjs) {
                    // const hash=`${md5(JSON.stringify(paquete.dependencies))}${md5(JSON.stringify(paquete.devDependencies))}`;

                    paquete.dependencies["source-map-support"] ??= paquetePropio["source-map-support"]??"*";

                    for (const [lib, version] of Object.entries(paquetePropio)) {
                        if (paquete.dependencies[lib]!=undefined) {
                            paquete.dependencies[lib] = version;
                        }
                        if (paquete.devDependencies[lib]!=undefined) {
                            paquete.devDependencies[lib] = version;
                        }
                    }
                    if (!config.cronjob) {
                        paquete.dependencies["@google-cloud/opentelemetry-cloud-trace-exporter"] ??= paquetePropio["@google-cloud/opentelemetry-cloud-trace-exporter"]??"*";
                        paquete.dependencies["@opentelemetry/api"] ??= paquetePropio["@opentelemetry/api"]??"*";
                        paquete.dependencies["@opentelemetry/core"] ??= paquetePropio["@opentelemetry/core"]??"*";
                        paquete.dependencies["@opentelemetry/instrumentation"] ??= paquetePropio["@opentelemetry/instrumentation"]??"*";
                        paquete.dependencies["@opentelemetry/instrumentation-http"] ??= paquetePropio["@opentelemetry/instrumentation-http"]??"*";
                        paquete.dependencies["@opentelemetry/resources"] ??= paquetePropio["@opentelemetry/resources"]??"*";
                        paquete.dependencies["@opentelemetry/sdk-trace-base"] ??= paquetePropio["@opentelemetry/sdk-trace-base"]??"*";
                        paquete.dependencies["@opentelemetry/sdk-trace-node"] ??= paquetePropio["@opentelemetry/sdk-trace-node"]??"*";
                        paquete.dependencies["@opentelemetry/semantic-conventions"] ??= paquetePropio["@opentelemetry/semantic-conventions"]??"*";
                        paquete.dependencies["chokidar"] ??= paquetePropio["chokidar"]??"*";
                        paquete.dependencies["hexoid"] ??= paquetePropio["hexoid"]??"*";
                        paquete.devDependencies["formidable"] ??= paquetePropio["formidable"]??"*";

                        if (paquete.dependencies["@google-cloud/trace-agent"] !== undefined) {
                            delete paquete.dependencies["@google-cloud/trace-agent"];
                        }
                        if (paquete.dependencies["@opentelemetry/context-async-hooks"] !== undefined) {
                            delete paquete.dependencies["@opentelemetry/context-async-hooks"];
                        }
                        if (paquete.dependencies["formidable"] !== undefined) {
                            delete paquete.dependencies["formidable"];
                        }

                        salida.openTelemetry = true;
                    }

                    if (paquete.devDependencies["source-map-support"]!==undefined) {
                        delete paquete.devDependencies["source-map-support"];
                    }

                    if (Object.keys(paquete.dependencies).length==0) {
                        delete paquete.dependencies;
                    }
                    if (Object.keys(paquete.devDependencies).length==0) {
                        delete paquete.devDependencies;
                    }
                }
            }

            await safeWrite(`${basedir}/cronjobs/${workspace}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
        }

        if (config.runtime==ERuntime.node && config.framework!=EFramework.nextjs) {
            await Promise.all([
                safeWrite(`${basedir}/cronjobs/${workspace}/app.js`, APP, true),
                safeWrite(`${basedir}/cronjobs/${workspace}/devel.js`, DEVEL, true),
                safeWrite(`${basedir}/cronjobs/${workspace}/init.js`, ``, false),
            ]);
        }

        if (await isFile(`${basedir}/cronjobs/${workspace}/output/.foreverignore`)) {
            console.log(Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/cronjobs/${workspace}/output/.foreverignore`));
            await unlink(`${basedir}/cronjobs/${workspace}/output/.foreverignore`);
        }
        if (await isFile(`${basedir}/cronjobs/${workspace}/output/devel.js`)) {
            console.log(Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/cronjobs/${workspace}/output/devel.js`));
            await unlink(`${basedir}/cronjobs/${workspace}/output/devel.js`);
        }
        if (await isFile(`${basedir}/cronjobs/${workspace}/output/devel.js.map`)) {
            console.log(Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/cronjobs/${workspace}/output/devel.js.map`));
            await unlink(`${basedir}/cronjobs/${workspace}/output/devel.js.map`);
        }
        if (await isFile(`${basedir}/cronjobs/${workspace}/pack.js`)) {
            console.log(Colors.colorize([Colors.FgYellow], `Eliminando ${basedir}/cronjobs/${workspace}/pack.js`));
            await unlink(`${basedir}/cronjobs/${workspace}/pack.js`);
        }

        salida.cambio = hash!=md5(JSON.stringify(paquete));

        return salida;
    }

    private static async initScripts(basedir: string, scripts: string[]): Promise<IConfiguracion> {
        console.log(Colors.colorize([Colors.FgWhite], "Inicializando scripts"));
        console.group();

        const config = this.reduceConfig(await Promise.all(scripts.map(script=>this.initScript(basedir, script))));

        console.groupEnd();
        return config;
    }

    private static async initScript(basedir: string, workspace: string): Promise<IConfiguracion> {
        const paquete = await readJSON(`${basedir}/scripts/${workspace}/package.json`);
        const hash = md5(JSON.stringify(paquete));
        paquete.scripts ??= {};
        paquete.scripts.packd = `yarn g:packd`;

        await safeWrite(`${basedir}/scripts/${workspace}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);

        return {
            openTelemetry: false,
            cambio: hash!=md5(JSON.stringify(paquete)),
        };
    }

    private static async initConfig(basedir: string, cronjobs: string[], services: string[]): Promise<void> {
        console.log(Colors.colorize([Colors.FgWhite], "Inicializando configuración de workspaces"));
        console.group();

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
        if (await isFile(file)) {
            try {
                const config = await readJSON<IConfigServices>(file);
                salida.devel.disabled.push(...config?.devel?.disabled?.filter(actual=>cronjobs.includes(actual) || services.includes(actual))??[]);
                salida.packd.disabled.push(...config?.packd?.disabled?.filter(actual=>cronjobs.includes(actual) || services.includes(actual))??[]);
                salida.i18n = config.i18n??true;
                salida.services = config.services??{};
            } catch (e) {

            }
        }
        for (const actual of [...cronjobs, ...services]) {
            if (!salida.devel.disabled.includes(actual)) {
                salida.devel.available.push(actual);
            }
            if (!salida.packd.disabled.includes(actual)) {
                salida.packd.available.push(actual);
            }
        }
        function sort(a: string, b: string): number {
            return a.localeCompare(b);
        }

        salida.devel.available = salida.devel.available.toSorted(sort);
        salida.devel.available.push("");
        salida.devel.disabled = salida.devel.disabled.toSorted(sort);
        salida.devel.disabled.push("");
        salida.packd.available = salida.packd.available.toSorted(sort);
        salida.packd.available.push("");
        salida.packd.disabled = salida.packd.disabled.toSorted(sort);
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
