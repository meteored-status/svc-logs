import {Comando} from "../comando";
import {EFramework, ERuntime, IConfigService} from "./service";
import {IPackageJson} from "../packagejson";
import {
    isDir,
    isFile,
    md5Dir,
    mkdir,
    readFileString,
    readJSON,
    safeWrite, unlink,
} from "../../../../modules/utiles/fs";
import {md5} from "../../../../modules/utiles/hash";

interface ITag {
    tags: string[];
}

export class Compilar {
    /* STATIC */
    public static async build(basedir: string, name: string): Promise<Compilar|null> {
        const dir = `${basedir}/services/${name}`;
        if (!await isDir(dir) || !await isFile(`${dir}/package.json`)) {
            console.error(name, "[ERROR]", "Servicio no válido");
            return null;
        }
        const json = await readJSON<IPackageJson>(`${dir}/package.json`);

        return new this(basedir, name, json);
    }

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
    protected readonly config: IConfigService
    private readonly dependencias: Compilar[];
    private readonly pendientes: NodeJS.Dict<null>;
    protected readonly dir: string;

    protected constructor(protected basedir: string, public name: string, protected readonly packagejson: IPackageJson) {
        this.config = packagejson.config;
        this.dependencias = [];
        this.pendientes = {};
        this.dir = `${basedir}/services/${name}`;
        for (const dep of this.config.deps) {
            this.pendientes[dep] = null;
        }
    }

    protected async guardar(): Promise<void> {
        await safeWrite(`${this.dir}/package.json`, `${JSON.stringify(this.packagejson, null, 2)}\n`, true, true);
    }

    public checkDependencias(dependencias: Compilar[]): void {
        for (const actual of dependencias) {
            if (actual.config.deps.includes(this.name)) {
                this.dependencias.push(actual);
            }
        }
    }

    public async pack(env: string, compilar?: Compilar): Promise<void> {
        if (compilar!=undefined) {
            delete this.pendientes[compilar.name];
            const keys = Object.keys(this.pendientes);
            if (keys.length>0) {
                console.log(this.name, "[     ]", "Esperando dependencias:", keys.join(", "));
                return;
            }
        }

        if (!this.config.generar ||!this.config.deploy) {
            if (this.dependencias.length==0) {
                console.log(this.name, "[OK   ]", "Servicio desactivado para despliegue");
                return;
            }

            console.warn(this.name, "[WARN ]", "Servicio desactivado para despliegue. Hay servicios dependientes que podrían no generarse correctamente:", this.dependencias.map((dependencia)=>dependencia.name).join(", "));
            return Promise.all(this.dependencias.map((dependencia)=>dependencia.pack(env, this))).then(()=>{});
        }

        await this.prepararCredenciales();

        switch (this.config.framework) {
            case EFramework.meteored:
                await this.packMeteored(env);
                break;
            case EFramework.nextjs:
                await this.packNextJS(env);
                break;
        }
        console.log(this.name, "[OK   ]", "Servicio compilado");

        if (this.dependencias.length==0) {
            return;
        }

        return Promise.all(this.dependencias.map((dependencia)=>dependencia.pack(env, this))).then(()=>{});
    }

    private async packMeteored(env: string): Promise<void> {
        switch(this.config.runtime) {
            case ERuntime.browser:
                await this.webpack(env);
                await this.checkVersionBrowser();
                break;
            case ERuntime.node:
                await this.webpack(env);
                await this.checkVersionService(env, [
                    `${this.basedir}/.yarnrc.yml`,
                    `${this.dir}/output`,
                    await isFile(`${this.dir}/Dockerfile`) ?
                        `${this.dir}/Dockerfile` :
                        `${this.basedir}/framework/services-comun/despliegue/Dockerfile`,
                    `${this.dir}/app.js`,
                    `${this.dir}/assets`,
                ]);
                break;
            case ERuntime.php:
                await this.checkVersionService(env, [
                    `${this.dir}/assets`,
                    `${this.dir}/base/nginx/local.conf`,
                    `${this.dir}/autoload.php`,
                    `${this.dir}/composer.json`,
                    `${this.dir}/composer.lock`,
                    await isFile(`${this.dir}/Dockerfile`) ?
                        `${this.dir}/Dockerfile` :
                        `${this.basedir}/framework/services-comun/despliegue/Dockerfile-php`,
                    `${this.dir}/Dockerfile`,
                    `${this.dir}/index.php`,
                    `${this.dir}/Meteored`,
                    `${this.dir}/vendor`,
                ]);
                break;
        }
    }

    private async webpack(env: string): Promise<void> {
        const {status, stderr} = await Comando.spawn("yarn", ["workspace", "services-comun", "webpack", "--env", `entorno=${env}`, "--config", `${this.dir}/webpack.production.config.js`], {cwd: this.basedir});
        if (status != 0) {
            console.error(this.name, "[KO   ]", "Error compilando:");
            console.error(stderr);
            return Promise.reject();
        }
    }

    private async packNextJS(env: string): Promise<void> {
        const nodeEnv = env=="test" ? "test" : "production";
        if (await isFile(`${this.dir}/.env.${nodeEnv}.local`)) {
            await safeWrite(`${this.dir}/.env.local`, await readFileString(`${this.dir}/.env.${nodeEnv}.local`), true, true);
        } else if (! await isFile(`${this.dir}/.env.local`)) {
            await safeWrite(`${this.dir}/.env.local`, `ENV=${env}`, true, true);
        }

        {
            const {status, stderr} = await Comando.spawn("yarn", ["run", this.name, "run", "next", "build"], {cwd: this.basedir});
            if (status != 0) {
                console.error(this.name, "[KO   ]", "Error compilando:");
                console.error(stderr);
                return Promise.reject();
            }
        }
        await this.checkVersionService(env, [
            `${this.basedir}/.yarnrc.yml`,
            `${this.dir}/output`,
            await isFile(`${this.dir}/Dockerfile`) ?
                `${this.dir}/Dockerfile` :
                `${this.basedir}/framework/services-comun/despliegue/Dockerfile-next`,
            `${this.basedir}/framework/services-comun/next.config.js`,
            `${this.basedir}/framework/services-comun/next.config.deps.js`,
            `${this.dir}/next.config.js`,
            `${this.dir}/public`,
        ]);
    }

    private async checkVersionService(env: string, checks: string[]): Promise<void> {
        const tags: string[] = [];

        if (await isFile(`${this.dir}/tags.json`)) {
            let datos = await readJSON<ITag | ITag[]>(`${this.dir}/tags.json`).catch(() => undefined);
            if (Array.isArray(datos)) {
                datos = datos[0];
            }
            if (datos?.tags != undefined && Array.isArray(datos.tags)) {
                tags.push(...datos.tags.filter((actual) => !["latest", "produccion", "test"].includes(actual)));
            }
        }

        let fecha: string|undefined;
        let index: string|undefined;
        let anterior: string|undefined;
        for (const actual of tags) {
            const partes = /^(\d{4}\.\d{2}\.\d{2})-(\d{3,})(.*)$/.exec(actual);
            if (partes==null) {
                anterior = actual;
            } else {
                fecha = partes[1];
                index = partes[2];
            }
        }

        for (const actual of this.config.deps) {
            checks.push(`${this.basedir}/services/${actual}/hash.txt`);
        }

        const hashes = [
            JSON.stringify(this.packagejson.dependencies??{}),
        ];
        for (const actual of checks) {
            hashes.push(await md5Dir(actual));
        }
        const hash = md5(
            hashes
                .filter(actual=>actual.length>0)
                .map(actual=>md5(actual)).join("")
        ).substring(0, 8);
        const md5Hash = `${hash}-${env}`;

        if (fecha==undefined || index==undefined || anterior!=md5Hash) {
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

        for (const {source, target} of this.config.credenciales) {
            if (await isFile(`${this.basedir}/kustomizar/tmp/credenciales/${source}`)) {
                const data = await readFileString(`${this.basedir}/kustomizar/tmp/credenciales/${source}`);
                await safeWrite(`${this.dir}/files/credenciales/${target}`, data);

                if (mysql!=undefined && target=="mysql.json") {
                    const json = JSON.parse(data);
                    if (json.master != undefined) {
                        json.master.socketPath = mysql;
                        if (json.slaves==undefined || !Array.isArray(json.slaves)) {
                            json.slaves = [json.master];
                        } else {
                            for (const actual of json.slaves) {
                                actual.socketPath = mysql;
                            }
                        }
                    } else if (json.slaves!=undefined && Array.isArray(json.slaves)) {
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
