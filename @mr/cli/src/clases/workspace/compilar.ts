/**
 * Editor: Bixus
 * Fecha: Wed, 11 Nov 2026 08:40:54 GMT
 * Hash: c51de67c204f2953163d3055212bdc24
 * Versión: 2026.11.11+1-bixus
 * Anterior: 2026.11.9+15-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import path from "node:path";

import {BuildBundler, BuildFW} from "@mr/core-dev/manifest/build";
import type {Manifest} from "@mr/core-dev/manifest";
import {Runtime} from "@mr/core-dev/manifest/deployment";
import {md5} from "services-comun/modules/utiles/hash";
import {
    isDir,
    isFile,
    md5Dir,
    mkdir,
    readFileString,
    readJSON,
    safeWrite,
    unlink,
} from "@mr/core-cli/fs";

import {leerBuildId, md5Fichero, PREVER_BUILD_ID} from "./build-id";
import {Comando} from "../comando";
import {Log} from "../log";
import type {IPackageJson} from "../packagejson";
import type {Manifest as ManifestRoot} from "../../../manifest";
import {ManifestWorkspaceLoader} from "../manifest/workspace";

interface ITag {
    tags: string[];
}

interface IPackConfig {
    compilar?: Compilar;
}

/**
 * Opciones del cálculo del hash de despliegue.
 *
 * @property previstos - Contenido de rutas que todavía no existen, por ruta (ver `md5Fichero`).
 */
interface IHashConfig {
    previstos?: Record<string, string>;
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

        // Sin generar (`deploy.build.enabled` a `false`) no se llega aquí: `run()` de `deploy.ts` termina
        // antes, y en Cloud Build la versión desplegada la mantiene `mantener-version`, sin `mrpack`.
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
                                checks.push(`${this.basedir}/@mr/cli/deployment/std/Dockerfile-next`);
                            }
                            break;

                        case BuildFW.meteored:
                        default:
                            checks.push(`${this.dir}/output`);
                            if (!customDockerfile) {
                                checks.push(`${this.basedir}/@mr/cli/deployment/std/Dockerfile`);
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

        const buildId = `${this.dir}/.next/BUILD_ID`;
        const checks = [
            `${this.basedir}/.yarnrc.yml`,
            buildId,
            await isFile(`${this.dir}/Dockerfile`) ?
                `${this.dir}/Dockerfile` :
                `${this.basedir}/@mr/cli/deployment/std/Dockerfile-next`,
            `${this.basedir}/framework/services-comun/next.config.js`,
            `${this.basedir}/framework/services-comun/next.config.deps.js`,
            `${this.dir}/next.config.js`,
            `${this.dir}/public`,
        ];

        // `next build` es casi todo el tiempo del paso «Compilar», y si el hash no cambia su salida
        // no se usa: no hay `nuevo.txt` y no se genera imagen. El `buildId` lo calcula el
        // `generateBuildId` del proyecto a partir de sus fuentes, así que se puede prever sin
        // compilar y, con él, el hash entero. Si coincide con el de la imagen desplegada, se omite.
        const previsto = manifest.deploy.build.force ? undefined : await this.preverBuildId(nodeEnv);
        if (previsto!==undefined) {
            const md5Hash = await this.hashServicio(env, checks, {previstos: {[buildId]: previsto}});
            if (!await this.esNuevaVersion(md5Hash, manifest)) {
                Log.info({type: Log.label_compilar, label: this.name}, "Sin cambios");
                await this.registrarVersion(env, manifest, md5Hash);
                return;
            }
        }

        {
            // todo falta añadir la fecha del commit (this.fecha)
            const {status, stderr} = await Comando("yarn", ["run", this.name, "run", "next", "build", "--webpack"], {cwd: this.basedir, env: {NODE_OPTIONS: '--max_old_space_size=10240', ZONA: nodeEnv}, colores: false});
            if (status != 0) {
                Log.error({type: Log.label_compilar, label: this.name}, "Error compilando:", stderr);
                throw new Error(`Error compilando "${this.name}" con next`);
            }
        }

        if (previsto!==undefined) {
            const real = await isFile(buildId) ? (await readFileString(buildId)).trim() : "";
            if (real!==previsto) {
                Log.error({type: Log.label_compilar, label: this.name}, `AVISO: next build ha dado el BUILD_ID ${real}, no el previsto ${previsto}. Mientras no coincidan, este workspace se compilará siempre aunque no cambie.`);
            } else if (md5Fichero(buildId, real)!==await md5Dir(buildId)) {
                Log.error({type: Log.label_compilar, label: this.name}, "AVISO: md5Fichero() ya no da lo mismo que md5Dir() para el BUILD_ID. Mientras no coincidan, este workspace se compilará siempre aunque no cambie.");
            }
        }
        await this.registrarVersion(env, manifest, await this.hashServicio(env, checks));
    }

    /**
     * Calcula, sin compilar, el `buildId` que dará `next build` (ver {@link PREVER_BUILD_ID}).
     *
     * @param nodeEnv - Valor de `ZONA`, el mismo que recibe `next build`.
     * @returns El `buildId`, o `undefined` si no se puede prever: el proyecto no tiene
     *          `generateBuildId` (Next usaría uno aleatorio) o el cálculo ha fallado. En los dos
     *          casos se compila, como siempre.
     */
    private async preverBuildId(nodeEnv: string): Promise<string|undefined> {
        const {status, stdout, stderr} = await Comando("yarn", ["run", this.name, "node", "-e", PREVER_BUILD_ID], {cwd: this.basedir, env: {NODE_ENV: "production", ZONA: nodeEnv}, colores: false});
        if (status !== 0) {
            Log.info({type: Log.label_compilar, label: this.name}, "No se puede prever el BUILD_ID; se compila:", stderr.trim());
            return undefined;
        }
        const id = leerBuildId(stdout);
        if (id===undefined) {
            Log.info({type: Log.label_compilar, label: this.name}, "Sin generateBuildId en next.config: el BUILD_ID es aleatorio y se compila siempre");
        }

        return id;
    }

    // Misma regla que `deployment/std/bin/mantener-version`, que la aplica en Cloud Build cuando no se
    // genera: si se cambia una, hay que cambiar la otra.
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

    // Solo para workspaces desactivados: su `hash.txt` entra en el hash de los que dependen de ellos
    // (`hashServicio`).
    private async mantenerVersion(env: string, manifest: ManifestRoot): Promise<void> {
        const [version = "0000.00.00-000", anterior = ""] = await this.getVersion(manifest.deploy.run.latest);
        await safeWrite(`${this.dir}/version.txt`, `${version}-${env}`, true, true);
        await safeWrite(`${this.dir}/hash.txt`, anterior, true, true);
    }

    private async checkVersionService(env: string, manifest: ManifestRoot, checks: string[]): Promise<void> {
        await this.registrarVersion(env, manifest, await this.hashServicio(env, checks));
    }

    /**
     * Hash de despliegue del workspace (`<hash>-<entorno>`): decide si hace falta una imagen nueva.
     *
     * @param env    - Entorno de despliegue.
     * @param checks - Ficheros y directorios que entran en el hash, además de las dependencias, la
     *                 plataforma y la imagen base.
     * @param config - `previstos`: rutas de `checks` cuyo contenido se conoce sin que existan todavía
     *                 (el `.next/BUILD_ID` antes de `next build`); se hashean como si lo hicieran.
     * @returns El hash, como se escribe en `hash.txt`.
     */
    private async hashServicio(env: string, checks: string[], {previstos = {}}: IHashConfig = {}): Promise<string> {
        const rutas = [
            ...checks,
            ...this.config.build.deps.map((actual)=>`${this.basedir}/services/${actual}/hash.txt`),
        ];

        const hashes = [
            JSON.stringify(this.packagejson.dependencies??{}),
        ];
        if (this.packagejson.optionalDependencies) {
            hashes.push(JSON.stringify(this.packagejson.optionalDependencies));
        }
        // Las plataformas también deciden la imagen: sin esto, añadir `linux/arm64` a `deploy.arch` no
        // generaba nada hasta el siguiente cambio de código. Solo entran si no son la de siempre
        // (`linux/amd64`, que es lo que construye `contenedor.sh` sin `deploy.arch`), para no regenerar
        // de golpe todas las imágenes que ya existen.
        const arch = [...this.config.deploy.arch ?? []].sort();
        if (arch.length > 0 && arch.join(",")!=="linux/amd64") {
            hashes.push(JSON.stringify(arch));
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
        // La versión de Node de la imagen base por defecto, que pasa compilar.sh en `MRPACK_NODE_VERSION`
        // (sale del `.node-version` del monorepo o de `_NODE_VERSION`): cambiarla tiene que regenerar la
        // imagen. No entra si el workspace fija su propia base, ni si es `lts`, el comportamiento de
        // siempre, para no regenerar nada en los proyectos que aún no han fijado versión.
        const imagenEntorno = env==="test" ? this.config.deploy.imagen?.test : this.config.deploy.imagen?.produccion;
        const versionNode = process.env["MRPACK_NODE_VERSION"] ?? "";
        if (imagenEntorno?.base===undefined && versionNode.length > 0 && versionNode!=="lts") {
            hashes.push(`node:${versionNode}`);
        }
        for (const actual of rutas) {
            const previsto = previstos[actual];
            hashes.push(previsto!==undefined ? md5Fichero(actual, previsto) : await md5Dir(actual));
        }
        const hash = md5(
            hashes
                .filter(actual=>actual.length>0)
                .map(actual=>md5(actual)).join("")
        ).substring(0, 8);

        return `${hash}-${env}`;
    }

    /**
     * Si el hash pide una versión nueva: no hay versión desplegada, el hash es otro que el de la
     * imagen desplegada, o el despliegue va forzado.
     *
     * @param md5Hash  - Hash de {@link hashServicio}.
     * @param manifest - Manifest raíz (para `deploy.build.force`).
     * @returns `true` si hay que generar imagen.
     */
    private async esNuevaVersion(md5Hash: string, manifest: ManifestRoot): Promise<boolean> {
        const [version, anterior] = await this.getVersion(true);
        const [fecha, index] = version?.split("-") ?? [];

        return fecha === undefined || index === undefined || anterior !== md5Hash || manifest.deploy.build.force;
    }

    /**
     * Escribe `version.txt`, `hash.txt` y la versión del `package.json`. Con versión nueva escribe
     * además `nuevo.txt`, que es lo que hace que el pipeline genere la imagen.
     *
     * @param env      - Entorno de despliegue.
     * @param manifest - Manifest raíz.
     * @param md5Hash  - Hash de {@link hashServicio}.
     */
    private async registrarVersion(env: string, manifest: ManifestRoot, md5Hash: string): Promise<void> {
        const [version] = await this.getVersion(true);
        const [fecha, index] = version?.split("-") ?? [];

        if (await this.esNuevaVersion(md5Hash, manifest)) {
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
        await mkdir(`${this.dir}/files/credenciales/`);

        let mysql: string|undefined;
        if (await isFile(`${this.basedir}/mysql.txt`)) {
            mysql = `/root/${await readFileString(`${this.basedir}/mysql.txt`)}`;
        }

        if (this.config.deploy.credenciales!=undefined) {
            for (const {source, target} of this.config.deploy.credenciales) {
                if (await isFile(`${this.basedir}/kustomizar/tmp/credenciales/${source}`)) {
                    const data = await readFileString(`${this.basedir}/kustomizar/tmp/credenciales/${source}`);
                    const destino = path.resolve(`${this.dir}/files/credenciales/${target}`);
                    await mkdir(path.dirname(destino));
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
