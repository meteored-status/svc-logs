/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 01 Jul 2026 07:11:52 GMT
 * Hash: 7507bd79e6678002509bdc28d3118d67
 * Versión: 2026.7.1+1-josantoniojimnez
 * Anterior: 2026.6.30+4-alexcg
 * Proyecto: https://github.com/alpred/tiempo-web-estaticos.git
 */

import path from "node:path";

import {BuildBundler, BuildFW} from "@mr/core-dev/manifest/build";
import {Manifest} from "@mr/core-dev/manifest";
import {Runtime} from "@mr/core-dev/manifest/deployment";
import {
    isDir,
    isFile,
    md5Dir,
    mkdir,
    readFileString,
    readJSON,
    safeWrite,
    unlink,
} from "services-comun/modules/utiles/fs";
import {md5} from "services-comun/modules/utiles/hash";

import {Comando} from "../comando";
import {Log} from "../log";
import {IPackageJson} from "../packagejson";
import type {Manifest as ManifestRoot} from "../../../../manifest";
import {ManifestWorkspaceLoader} from "../manifest/workspace";

interface ITag {
    tags: string[];
}

interface IPackConfig {
    compilar?: Compilar;
}

/**
 * Gestiona la compilación y despliegue de un workspace del monorepo.
 * Soporta los frameworks `meteored` (rspack) y `nextjs`, y los runtimes `node`, `browser` y `php`.
 */
export class Compilar {
    /* STATIC */
    /**
     * Construye una instancia de `Compilar` para el workspace indicado.
     *
     * @param basedir - Raíz absoluta del monorepo.
     * @param name    - Nombre del workspace (directorio).
     * @param path    - Subdirectorio relativo a `basedir` donde se aloja el workspace (p.ej. `"services"`).
     * @returns Instancia configurada, o `null` si el directorio no es un workspace válido.
     */
    public static async build(basedir: string, name: string, path: string): Promise<Compilar|null> {
        const dir = `${basedir}/${path}/${name}`;
        if (!await isDir(dir) || !await isFile(`${dir}/package.json`)) {
            Log.error({type: Log.label_compilar, label: name}, "Servicio no válido");
            return null;
        }
        const json = await readJSON<IPackageJson>(`${dir}/package.json`);
        const {manifest} = await new ManifestWorkspaceLoader(dir).load();

        return new this(basedir, name, path, json, manifest);
    }

    /**
     * Calcula y guarda el hash MD5 del directorio de caché de Yarn (`.yarn/cache/.md5`).
     * Si el directorio no existe, no hace nada.
     *
     * @param basedir - Raíz absoluta del monorepo.
     */
    public static async md5Deps(basedir: string): Promise<void> {
        const dir = `${basedir}/.yarn/cache`;
        if (!await isDir(dir)) {
            return;
        }

        const file = `${dir}/.md5`;
        if (await isFile(file)) {
            await unlink(file);
        }
        await safeWrite(file, `${await md5Dir(dir)}\n`, true);
    }

    /* INSTANCE */
    public readonly dependiente: boolean;
    private readonly dependencias: Compilar[];
    private readonly pendientes: NodeJS.Dict<null>;
    protected readonly dir: string;

    protected constructor(protected basedir: string, public name: string, public path: string, protected readonly packagejson: IPackageJson, protected readonly config: Manifest) {
        this.dependencias = [];
        this.pendientes = {};
        this.dir = `${basedir}/${path}/${name}`;
        for (const dep of this.config.build.deps) {
            this.pendientes[dep] = null;
        }
        this.dependiente = this.config.build.deps.length>0;
    }

    /**
     * Persiste el `package.json` del workspace en disco con indentado de 2 espacios.
     *
     */
    protected async guardar(): Promise<void> {
        await safeWrite(`${this.dir}/package.json`, `${JSON.stringify(this.packagejson, null, 2)}\n`, true, true);
    }

    /**
     * Registra los workspaces que dependen de éste (i.e. los que listan este workspace en `build.deps`).
     * Tras llamar a este método `this.dependencias` contiene los workspaces dependientes,
     * necesario para propagar la señal de compilación completada en `pack`.
     *
     * @param dependencias - Lista completa de compiladores del monorepo.
     */
    public checkDependencias(dependencias: Compilar[]): void {
        for (const actual of dependencias) {
            if (actual.config.build.deps.includes(this.name)) {
                this.dependencias.push(actual);
            }
        }
    }

    /**
     * Genera el artefacto de despliegue del workspace (compilación + cálculo de versión).
     * Respeta el grafo de dependencias: espera a que todos sus `build.deps` hayan terminado
     * antes de ejecutar y, al finalizar, notifica a los workspaces dependientes.
     *
     * @param env      - Entorno de despliegue (`"test"` o `"produccion"`).
     * @param manifest - Manifest raíz del monorepo con la configuración global de despliegue.
     * @param config   - Objeto de configuración; si contiene `compilar`, indica el workspace que acaba de terminar.
     */
    public async pack(env: string, manifest: ManifestRoot, {compilar}: IPackConfig = {}): Promise<void> {
        if (compilar!=undefined) {
            delete this.pendientes[compilar.name];
            const keys = Object.keys(this.pendientes);
            if (keys.length>0) {
                Log.info({type: Log.label_compilar, label: this.name}, "Esperando dependencias:", keys.join(", "));
                return;
            }
        }

        if (!this.config.enabled || !this.config.deploy.enabled) {
            await this.mantenerVersion(env, manifest);

            if (this.dependencias.length==0) {
                Log.info({type: Log.label_compilar, label: this.name}, "Servicio desactivado para despliegue");
                return;
            }

            Log.info({type: Log.label_compilar, label: this.name}, "Servicio desactivado para despliegue. Hay servicios dependientes que podrían no generarse correctamente:", this.dependencias.map((dependencia)=>dependencia.name).join(", "));
            return Promise.all(this.dependencias.map((dependencia) => dependencia.pack(env, manifest, {compilar: this}))).then(() => undefined);
        }

        if (manifest.deploy.build.enabled) {
            await this.prepararCredenciales();

            switch (this.config.build.framework) {
                case BuildFW.meteored:
                    await this.packMeteored(env, manifest);
                    break;
                case BuildFW.nextjs:
                    await this.packNextJS(env, manifest);
                    break;
            }
            Log.info({type: Log.label_compilar, label: this.name}, "Servicio compilado");
        } else {
            await this.mantenerVersion(env, manifest);
            Log.info({type: Log.label_compilar, label: this.name}, "Versión mantenida");
        }

        if (this.dependencias.length==0) {
            return;
        }

        return Promise.all(this.dependencias.map((dependencia) => dependencia.pack(env, manifest, {compilar: this}))).then(() => undefined);
    }

    private async packMeteored(env: string, manifest: ManifestRoot): Promise<void> {
        switch(this.config.deploy.runtime) {
            case Runtime.browser: {
                    await this.rspack(env);
                    await this.checkVersionBrowser();
                }
                break;
            case Runtime.node: {
                    const customDockerfile = await isFile(`${this.dir}/Dockerfile`);
                    if (this.config.build.bundler===BuildBundler.rspack) {
                        await this.rspack(env);
                    } else {
                        await this.esbuild(env);
                    }
                    const checks: string[] = [
                        `${this.basedir}/.yarnrc.yml`,
                    ];
                    if (customDockerfile) {
                        checks.push(`${this.dir}/Dockerfile`);
                    }
                    switch(this.config.build.framework) {
                        case BuildFW.nextjs:
                            checks.push(`${this.dir}/.next/BUILD_ID`);
                            if (!customDockerfile) {
                                checks.push(`${this.basedir}/framework/services-comun/despliegue/Dockerfile-next`);
                            }
                            break;

                        case BuildFW.meteored:
                        default:
                            checks.push(`${this.dir}/output`);
                            if (!customDockerfile) {
                                checks.push(`${this.basedir}/framework/services-comun/despliegue/Dockerfile`);
                            }
                            break;
                    }
                    checks.push(
                        `${this.dir}/app.js`,
                        `${this.dir}/assets`,
                    );
                await this.checkVersionService(env, manifest, checks);
                }
                break;
            case Runtime.php: {
                await this.checkVersionService(env, manifest, [
                    `${this.dir}/assets`,
                    `${this.dir}/base/nginx/local.conf`,
                    `${this.dir}/autoload.php`,
                    `${this.dir}/composer.json`,
                    `${this.dir}/composer.lock`,
                    await isFile(`${this.dir}/Dockerfile`) ?
                        `${this.dir}/Dockerfile` :
                        `${this.basedir}/framework/services-comun/despliegue/Dockerfile-php`,
                    `${this.dir}/index.php`,
                    `${this.dir}/Meteored`,
                    `${this.dir}/vendor`,
                ]);
                }
                break;
        }
    }

    private async rspack(env: string): Promise<void> {
        const {status, stdout, stderr} = await Comando("yarn", ["workspace", "@mr/core-dev", "rspack", "--env", `entorno=${env}`, "--env", `dir="${this.dir}"`, "--config", `bundler/rspack/rspack.config.ts`], {cwd: this.basedir, colores: false});
        if (status != 0) {
            Log.error({type: Log.label_compilar, label: this.name}, "Error compilando:", stdout, stderr);
            throw new Error(`Error compilando "${this.name}" con rspack`);
        }
    }

    private async esbuild(env: string): Promise<void> {
        const {status, stdout, stderr} = await Comando("yarn", ["workspace", "@mr/core-dev", "node", "bundler/esbuild/esbuild.config.mjs", "--env", `entorno=${env}`, "--env", `dir="${this.dir}"`], {cwd: this.basedir, colores: false});
        if (status != 0) {
            Log.error({type: Log.label_compilar, label: this.name}, "Error compilando:", stdout, stderr);
            throw new Error(`Error compilando "${this.name}" con esbuild`);
        }
    }

    private async packNextJS(env: string, manifest: ManifestRoot): Promise<void> {
        const nodeEnv = env=="test" ? "test" : "production";
        if (await isFile(`${this.dir}/.env.${nodeEnv}.local`)) {
            await safeWrite(`${this.dir}/.env.local`, await readFileString(`${this.dir}/.env.${nodeEnv}.local`), true, true);
        } else if (! await isFile(`${this.dir}/.env.local`)) {
            await safeWrite(`${this.dir}/.env.local`, `ENV=${env}`, true, true);
        } else {
            Log.info({type: Log.label_compilar, label: this.name}, "Existe el fichero .env.local, se mantiene tal cual.");
        }

        {
            // todo falta añadir la fecha del commit (this.fecha)
            const {status, stderr} = await Comando("yarn", ["run", this.name, "run", "next", "build", "--webpack"], {cwd: this.basedir, env: {NODE_OPTIONS: '--max_old_space_size=10240', ZONA: nodeEnv}, colores: false});
            if (status != 0) {
                Log.error({type: Log.label_compilar, label: this.name}, "Error compilando:", stderr);
                throw new Error(`Error compilando "${this.name}" con next`);
            }
        }
        await this.checkVersionService(env, manifest, [
            `${this.basedir}/.yarnrc.yml`,
            `${this.dir}/.next/BUILD_ID`,
            await isFile(`${this.dir}/Dockerfile`) ?
                `${this.dir}/Dockerfile` :
                `${this.basedir}/framework/services-comun/despliegue/Dockerfile-next`,
            `${this.basedir}/framework/services-comun/next.config.js`,
            `${this.basedir}/framework/services-comun/next.config.deps.js`,
            `${this.dir}/next.config.js`,
            `${this.dir}/public`,
        ]);
    }

    private async getVersion(latest: boolean): Promise<[string | undefined, string | undefined]> {
        const tags: string[] = [];

        if (await isFile(`${this.dir}/tags.json`)) {
            let datos = await readJSON<ITag | ITag[]>(`${this.dir}/${latest ? "tags.json" : "deployed.json"}`).catch(() => undefined);
            if (Array.isArray(datos)) {
                datos = datos[0];
            }
            if (datos?.tags != undefined && Array.isArray(datos.tags)) {
                tags.push(...datos.tags.filter((actual) => !["latest", "produccion", "test", "deployed_produccion", "deployed_test"].includes(actual)));
            }
        }

        let version: string | undefined;
        let hash: string | undefined;
        for (const actual of tags) {
            const partes = /^(\d{4}\.\d{2}\.\d{2})-(\d{3,}).*$/.exec(actual);
            if (partes==null) {
                hash = actual;
            } else {
                version = `${partes[1]}-${partes[2]}`;
            }
        }

        return [version, hash];
    }

    private async mantenerVersion(env: string, manifest: ManifestRoot): Promise<void> {
        const [version = "0000.00.00-000", anterior = ""] = await this.getVersion(manifest.deploy.run.latest);
        await safeWrite(`${this.dir}/version.txt`, `${version}-${env}`, true, true);
        await safeWrite(`${this.dir}/hash.txt`, anterior, true, true);
    }

    private async checkVersionService(env: string, manifest: ManifestRoot, checks: string[]): Promise<void> {
        const [version, anterior] = await this.getVersion(true);
        let fecha: string | undefined;
        let index: string | undefined;
        if (version != undefined) {
            const partes = version.split("-");
            fecha = partes[0];
            index = partes[1];
        }

        for (const actual of this.config.build.deps) {
            checks.push(`${this.basedir}/services/${actual}/hash.txt`);
        }

        const hashes = [
            JSON.stringify(this.packagejson.dependencies??{}),
        ];
        if (this.packagejson.optionalDependencies) {
            hashes.push(JSON.stringify(this.packagejson.optionalDependencies));
        }
        if (this.config.deploy.imagen) {
            if (env==="test") {
                if (this.config.deploy.imagen.test) {
                    if (this.config.deploy.imagen.test.base) {
                        hashes.push(this.config.deploy.imagen.test.base);
                    }
                    if (this.config.deploy.imagen.test.registro) {
                        hashes.push(this.config.deploy.imagen.test.registro);
                    }
                    hashes.push(this.config.deploy.imagen.test.paquete);
                    hashes.push(this.config.deploy.imagen.test.nombre);
                }
            } else if (this.config.deploy.imagen.produccion) {
                if (this.config.deploy.imagen.produccion.base) {
                    hashes.push(this.config.deploy.imagen.produccion.base);
                }
                if (this.config.deploy.imagen.produccion.registro) {
                    hashes.push(this.config.deploy.imagen.produccion.registro);
                }
                hashes.push(this.config.deploy.imagen.produccion.paquete);
                hashes.push(this.config.deploy.imagen.produccion.nombre);
            }
        }
        for (const actual of checks) {
            hashes.push(await md5Dir(actual));
        }
        const hash = md5(
            hashes
                .filter(actual=>actual.length>0)
                .map(actual=>md5(actual)).join("")
        ).substring(0, 8);
        const md5Hash = `${hash}-${env}`;

        if (fecha == undefined || index == undefined || anterior != md5Hash || manifest.deploy.build.force) {
            const date = new Date();
            const fechaActual = [
                date.getUTCFullYear(),
                `0${date.getUTCMonth()+1}`.slice(-2),
                `0${date.getUTCDate()}`.slice(-2),
            ].join(".");

            let indice;
            if (fecha==fechaActual) {
                indice = `00${parseInt(index??"0")+1}`.slice(-3);
            } else {
                indice = "001";
            }

            this.packagejson.version = `${fechaActual}-${indice}`;
            await safeWrite(`${this.dir}/nuevo.txt`, "1", true, true);
        } else {
            this.packagejson.version = `${fecha}-${index}`;
        }

        await safeWrite(`${this.dir}/version.txt`, `${this.packagejson.version}-${env}`, true, true);
        await safeWrite(`${this.dir}/hash.txt`, md5Hash, true, true);

        await this.guardar();
    }

    private async checkVersionBrowser(): Promise<void> {
        const hash = await md5Dir(`${this.dir}/output`);
        await safeWrite(`${this.dir}/output/hash.txt`, hash, true, true);
        await safeWrite(`${this.dir}/hash.txt`, hash, true, true);
    }

    private async prepararCredenciales(): Promise<void> {
        await mkdir(`${this.dir}/files/credenciales/`, true);

        let mysql: string|undefined;
        if (await isFile(`${this.basedir}/mysql.txt`)) {
            mysql = `/root/${await readFileString(`${this.basedir}/mysql.txt`)}`;
        }

        if (this.config.deploy.credenciales!=undefined) {
            for (const {source, target} of this.config.deploy.credenciales) {
                if (await isFile(`${this.basedir}/kustomizar/tmp/credenciales/${source}`)) {
                    const data = await readFileString(`${this.basedir}/kustomizar/tmp/credenciales/${source}`);
                    const destino = path.resolve(`${this.dir}/files/credenciales/${target}`);
                    await mkdir(path.dirname(destino), true);
                    await safeWrite(destino, data);

                    if (mysql != undefined && target == "mysql.json") {
                        const json = JSON.parse(data);
                        if (json.master != undefined) {
                            json.master.socketPath = mysql;
                            if (json.slaves == undefined || !Array.isArray(json.slaves)) {
                                json.slaves = [json.master];
                            } else {
                                for (const actual of json.slaves) {
                                    actual.socketPath = mysql;
                                }
                            }
                        } else if (json.slaves != undefined && Array.isArray(json.slaves)) {
                            for (const actual of json.slaves) {
                                actual.socketPath = mysql;
                            }
                        }
                        if (json.socketPath != undefined) {
                            json.socketPath = mysql;
                        }
                        await safeWrite(`${this.dir}/files/credenciales/${target}`, JSON.stringify(json));
                    }
                }
            }
        }
    }
}
