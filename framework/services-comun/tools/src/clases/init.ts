import {Colors} from "./colors";
import {EFramework, ERuntime, IConfigService, IConfigServices} from "./workspace/service";
import {isDir, isFile, readDir, readFileString, readJSON, safeWrite, unlink} from "../../../modules/utiles/fs";
import APP from "./init/app";
// import APP_DEPLOYMENT from "./init/app-deployment";
import ATTRIBUTES from "./init/attributes";
import DEVEL from "./init/devel";
import IGNORE from "./init/ignore";
import {md5} from "../../../modules/utiles/hash";

interface IConfiguracion {
    openTelemetry: boolean;
    cambio: boolean;
}

export class Init {
    /* STATIC */
    public static async init(basedir: string): Promise<boolean> {
        console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Inicializando"));
        console.group();
        const [workspaces, scripts] = await this.initBase(basedir);
        await this.deleteFiles(basedir);
        const config = this.reduceConfig([
            await this.initServices(basedir, workspaces),
            await this.initScripts(basedir, scripts),
        ]);

        await this.initConfig(basedir, workspaces);
        const cambio = await this.initYarnRC(basedir, config);

        console.groupEnd();

        return cambio || config.cambio;
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

    private static async initBase(basedir: string): Promise<[string[], string[]]> {
        console.log(Colors.colorize([Colors.FgWhite], "Inicializando proyecto"));
        console.group();
        const workspaces = [];
        const scripts = [];

        const paquete = await readJSON(`${basedir}/package.json`);
        paquete.scripts = {
            "mrpack": "yarn workspace services-comun mrpack",
            "doctor": "yarn dlx @yarnpkg/doctor",
            "devel": "yarn mrpack devel -e",
            "devel-f": "yarn mrpack devel -e -f",
            "g:devel": "cd \"$INIT_CWD\" && yarn node --watch --no-warnings devel.js",
            "packd": "yarn mrpack devel -c",
            "packd-f": "yarn mrpack devel -c -f",
            "g:packd": "TS_NODE_PROJECT=\"webpack/tsconfig.json\" yarn workspace services-comun webpack --env entorno=desarrollo --env dir=\"$INIT_CWD\" --config \"webpack/webpack.config.ts\"",
            // "g:packd": "yarn workspace services-comun webpack --env entorno=desarrollo --env dir=\"$INIT_CWD\" --config \"$INIT_CWD/webpack.develop.config.js\"",
            // "deploy": "yarn node framework/services-comun/deploy.js $ENV | sh",
            "update": "yarn mrpack update",
        };
        if (await isDir(`${basedir}/framework`)) {
            //const alias: NodeJS.Dict<string> = {};
            for (const actual of await readDir(`${basedir}/framework`)) {
                if (await this.isValid(`${basedir}/framework/${actual}`)) {
                    // try {
                    //     const subpaquete = await readJSON(`${basedir}/framework/${actual}/package.json`);
                    //     if (subpaquete.alias!==undefined) {
                    //         alias[subpaquete.alias] = `yarn workspace ${actual}`;
                    //     }
                    // } catch (e) {
                    // }
                    paquete.scripts[actual] = `yarn workspace ${actual}`;
                } else {
                    await unlink(`${basedir}/framework/${actual}`);
                }
            }
            // paquete.scripts = {
            //     ...paquete.scripts,
            //     ...alias,
            // };
        }

        if (await isDir(`${basedir}/services`)) {
            for (const actual of await readDir(`${basedir}/services`)) {
                if (await this.isValid(`${basedir}/services/${actual}`)) {
                    paquete.scripts[actual] = `yarn workspace ${actual}`;
                    workspaces.push(actual);
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

        if (await isDir(`${basedir}/statics`)) {
            for (const actual of await readDir(`${basedir}/statics`)) {
                if (await this.isValid(`${basedir}/statics/${actual}`)) {
                    paquete.scripts[actual] = `yarn workspace ${actual}`;
                    // workspaces.push(actual);
                } else {
                    await unlink(`${basedir}/statics/${actual}`);
                }
            }
        }


        paquete.workspaces = [
            "framework/*",
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
        // paquete.dependencies = {
        // };
        // paquete.devDependencies = {
        //     // concurrently: paquete.devDependencies?.concurrently??"*",
        // };

        await safeWrite(`${basedir}/.gitattributes`, ATTRIBUTES, true);
        await safeWrite(`${basedir}/.gitignore`, IGNORE, true);
        await safeWrite(`${basedir}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);

        console.groupEnd();
        return [workspaces, scripts];
    }

    private static async deleteFiles(basedir: string): Promise<void> {
        console.log(Colors.colorize([Colors.FgWhite], "Revisando archivos innecesarios"));
        console.group();
        for (const file of ["update.sh", "run.sh"]) {
            if (await isFile(`${basedir}/${file}`)) {
                console.log(`Eliminando ${Colors.colorize([Colors.FgYellow], file)}`);
                await unlink(`${basedir}/${file}`);
            }
        }
        for (const actual of await readDir(`${basedir}/framework`)) {
            for (const file of ["download.js", "upload.js"]) {
                if (await isFile(`${basedir}/framework/${actual}/${file}`)) {
                    console.log(`Eliminando ${Colors.colorize([Colors.FgYellow], `${actual}/${file}`)}`);
                    await unlink(`${basedir}/framework/${actual}/${file}`);
                }
            }
        }
        console.groupEnd();
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

        const paquetePropio = await readJSON(`${basedir}/framework/${process.env["npm_package_name"]}/package.json`);
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
        config.unico = paquete.config.unico??paquete.unico??false;

        config.deps = paquete.config.deps??[];
        config.storage = paquete.config.storage??paquete.storage??[];

        config.runtime = paquete.config.runtime??(!resources?ERuntime.node:ERuntime.browser);
        if (paquete.config.framework!==undefined) {
            config.framework = paquete.config.framework;
        } else if (!nextjs.enabled) {
            config.framework = EFramework.meteored;
        } else {
            config.framework = EFramework.nextjs;
        }
        if (paquete.config.credenciales!==undefined) {
            config.credenciales = paquete.config.credenciales;
        } else {
            config.credenciales = nextjs.credenciales??[];
        }
        config.bundle = paquete.config.bundle??{};

        paquete.config = config;

        if (paquete.nodemonConfig!=undefined) {
            delete paquete.nodemonConfig;
        }

        if (paquete.config.generar) {
            paquete.scripts ??= {};
            switch(paquete.config.framework) {
                case EFramework.meteored:
                    paquete.scripts.packd = `yarn g:packd`;
                    switch(config.runtime) {
                        case ERuntime.node:
                            if (!paquete.config.cronjob) {
                                paquete.scripts.devel = "yarn g:devel";
                            } else {
                                paquete.scripts.devel = "yarn node --no-warnings devel.js";
                            }
                            paquete.version = "0000.00.00-000";
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

            if (config.runtime==ERuntime.node && config.framework!=EFramework.nextjs) {
                paquete.dependencies??={};
                paquete.devDependencies??={};

                const hash=`${md5(JSON.stringify(paquete.dependencies))}${md5(JSON.stringify(paquete.devDependencies))}`;

                paquete.dependencies["source-map-support"] ??= paquetePropio.devDependencies["source-map-support"]??"*";

                for (const [lib, version] of Object.entries(paquetePropio.devDependencies)) {
                    if (paquete.dependencies[lib]!=undefined) {
                        paquete.dependencies[lib] = version;
                    }
                    if (paquete.devDependencies[lib]!=undefined) {
                        paquete.devDependencies[lib] = version;
                    }
                }
                if (!config.cronjob) {
                    paquete.dependencies["@google-cloud/opentelemetry-cloud-trace-exporter"] ??= paquetePropio.devDependencies["@google-cloud/opentelemetry-cloud-trace-exporter"]??"*";
                    paquete.dependencies["@opentelemetry/api"] ??= paquetePropio.devDependencies["@opentelemetry/api"]??"*";
                    paquete.dependencies["@opentelemetry/core"] ??= paquetePropio.devDependencies["@opentelemetry/core"]??"*";
                    paquete.dependencies["@opentelemetry/instrumentation"] ??= paquetePropio.devDependencies["@opentelemetry/instrumentation"]??"*";
                    paquete.dependencies["@opentelemetry/instrumentation-http"] ??= paquetePropio.devDependencies["@opentelemetry/instrumentation-http"]??"*";
                    paquete.dependencies["@opentelemetry/resources"] ??= paquetePropio.devDependencies["@opentelemetry/resources"]??"*";
                    paquete.dependencies["@opentelemetry/sdk-trace-base"] ??= paquetePropio.devDependencies["@opentelemetry/sdk-trace-base"]??"*";
                    paquete.dependencies["@opentelemetry/sdk-trace-node"] ??= paquetePropio.devDependencies["@opentelemetry/sdk-trace-node"]??"*";
                    paquete.dependencies["@opentelemetry/semantic-conventions"] ??= paquetePropio.devDependencies["@opentelemetry/semantic-conventions"]??"*";
                    paquete.dependencies["chokidar"] ??= paquetePropio.devDependencies["chokidar"]??"*";
                    paquete.dependencies["hexoid"] ??= paquetePropio.devDependencies["hexoid"]??"*";
                    paquete.devDependencies["formidable"] ??= paquetePropio.devDependencies["formidable"]??"*";

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
                if (Object.keys(paquete.devDependencies).length==0) {
                    delete paquete.devDependencies;
                }

                if (Object.keys(paquete.dependencies).length==0) {
                    delete paquete.dependencies;
                }
                if (Object.keys(paquete.devDependencies).length==0) {
                    delete paquete.devDependencies;
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

    private static async initConfig(basedir: string, workspace: string[]): Promise<void> {
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
            services: {},
        };
        if (await isFile(file)) {
            try {
                const config = await readJSON<IConfigServices>(file);
                salida.devel.disabled.push(...config?.devel?.disabled?.filter(actual=>workspace.includes(actual))??[]);
                salida.packd.disabled.push(...config?.packd?.disabled?.filter(actual=>workspace.includes(actual))??[]);
                salida.services = config.services??{};
            } catch (e) {

            }
        }
        for (const actual of workspace) {
            if (!salida.devel.disabled.includes(actual)) {
                salida.devel.available.push(actual);
            }
            if (!salida.packd.disabled.includes(actual)) {
                salida.packd.available.push(actual);
            }
        }
        salida.devel.available = salida.devel.available.sort();
        salida.devel.available.push("");
        salida.devel.disabled = salida.devel.disabled.sort();
        salida.devel.disabled.push("");
        salida.packd.available = salida.packd.available.sort();
        salida.packd.available.push("");
        salida.packd.disabled = salida.packd.disabled.sort();
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

        const libs: NodeJS.Dict<string> = {
        };
        const exlibs = [`mysql2@*:`];

        if (config.openTelemetry) {
            libs["@google-cloud/opentelemetry-cloud-trace-exporter"] = "@opentelemetry/semantic-conventions";
            libs["@google-cloud/opentelemetry-resource-util"] = "@opentelemetry/api";
        }

        for (const [lib, dep] of Object.entries(libs)) {
            if (!corrientes.includes(`  "${lib}@*":`)) {
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
