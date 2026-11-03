/**
 * Editor: alexCG
 * Fecha: Tue, 20 Oct 2026 07:44:09 GMT
 * Hash: 9c2bc5dd4c8c68cc58d35da53d3f698b
 * Versión: 2026.10.20+1-alexcg
 * Anterior: 2026.9.23+2-bixus
 * Proyecto: https://github.com/alpred/meteored-svc-amateur.git
 */

import {BuildFW} from "@mr/core-dev/manifest/build";
import {ManifestDeploymentKind} from "@mr/core-dev/manifest/deployment";
import {buscarDeclaraciones} from "@mr/core-dev/pubsub/descubrir";
import {isDir, mkdir, readDir, readJSON, safeWrite, unlink} from "@mr/core-cli/fs";
import {Colors} from "@mr/core-cli/colors";

import {Log} from "../log";
import {ManifestWorkspaceLoader} from "../manifest/workspace";
import type {IPackageJson} from "../packagejson";
import type {IWorkspaces} from "./config-workspaces";
import {type IWorkspaceLocal, workspacesDelMonorepo} from "./workspace-deps";

/** Tipos de despliegue para los que se genera una acción de depuración. */
const TIPOS: ManifestDeploymentKind[] = [ManifestDeploymentKind.SERVICE, ManifestDeploymentKind.CRONJOB, ManifestDeploymentKind.JOB];

/**
 * Nombre de fichero de una acción generada por {@link initRun}: la de depuración de cada workspace
 * (`service-x.run.xml`, y `service-x.pubsub.run.xml` si además tiene la de Pub/Sub) y las de la raíz de Pub/Sub
 * (`mrpack-pubsub-*.run.xml`).
 */
const REGEX_FICHERO = /^(?:(?:service|cronjob|job)-.+|mrpack-pubsub-.+)\.run\.xml$/;

interface IRunTemplate {
    type: ManifestDeploymentKind;
    service: string;
}

/**
 * Acción de la raíz que lanza `mrpack`.
 *
 * @property fichero - Nombre del fichero en `.run/`.
 * @property nombre - Nombre de la acción en el IDE.
 * @property argumentos - Lo que se le pasa a `yarn mrpack`.
 * @property sinAvisos - Si `true`, lanza con `NODE_NO_WARNINGS=1` (las acciones de una sola pasada, como las de `framework`).
 */
interface IRunMrpack {
    fichero: string;
    nombre: string;
    argumentos: string;
    sinAvisos: boolean;
}

/**
 * Acciones de la raíz de Pub/Sub, que solo se generan si el monorepo tiene algún `mrpack.pubsub.ts`.
 */
const RUN_MRPACK_PUBSUB: IRunMrpack[] = [
    {fichero: "mrpack-pubsub-ejecutar.run.xml", nombre: "develop => Ejecutar + PubSub", argumentos: "devel -e -p", sinAvisos: false},
    {fichero: "mrpack-pubsub-compilar-ejecutar.run.xml", nombre: "develop => Compilar + Ejecutar + PubSub", argumentos: "devel -c -e -w -p", sinAvisos: false},
    {fichero: "mrpack-pubsub-estado.run.xml", nombre: "cli => PubSub estado", argumentos: "pubsub -s", sinAvisos: true},
    {fichero: "mrpack-pubsub-reset.run.xml", nombre: "cli => PubSub reset", argumentos: "pubsub -r", sinAvisos: true},
];

function RUN({type, service}: IRunTemplate): string {
    return `
<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="ejecutar => ${type} => ${service}" type="js.build_tools.npm">
    <package-json value="$PROJECT_DIR$/package.json" />
    <command value="run" />
    <scripts>
      <script value="${service}" />
    </scripts>
    <arguments value="run devel" />
    <node-interpreter value="project" />
    <envs />
    <method v="2" />
  </configuration>
</component>
`.trimStart();
}

function runPubSub({type, service}: IRunTemplate): string {
    return `
<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="ejecutar + pubsub => ${type} => ${service}" type="js.build_tools.npm">
    <package-json value="$PROJECT_DIR$/@mr/cli/package.json" />
    <command value="run" />
    <scripts>
      <script value="mrpack" />
    </scripts>
    <arguments value="devel -e -p --solo=${service}" />
    <node-interpreter value="project" />
    <envs />
    <method v="2" />
  </configuration>
</component>
`.trimStart();
}

function runMrpack({nombre, argumentos, sinAvisos}: IRunMrpack): string {
    const envs = sinAvisos
        ? `<envs>
      <env name="NODE_NO_WARNINGS" value="1" />
    </envs>`
        : "<envs />";
    return `
<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="${nombre}" type="js.build_tools.npm">
    <package-json value="$PROJECT_DIR$/@mr/cli/package.json" />
    <command value="run" />
    <scripts>
      <script value="mrpack" />
    </scripts>
    <arguments value="${argumentos}" />
    <node-interpreter value="project" />
    ${envs}
    <method v="2" />
  </configuration>
</component>
`.trimStart();
}

/**
 * Dependencias de cada workspace del monorepo en otros workspaces del monorepo: las `dependencies` y `devDependencies` con
 * protocolo `workspace:` cuyo nombre es el de un workspace.
 *
 * @param workspaces - Workspaces del monorepo.
 * @returns Nombre de cada workspace → nombres de los workspaces de los que depende.
 */
async function grafoDependencias(workspaces: IWorkspaceLocal[]): Promise<Map<string, string[]>> {
    const nombres = new Set(workspaces.map(({nombre}) => nombre));
    const grafo = new Map<string, string[]>();
    for (const {dir, nombre} of workspaces) {
        const paquete = await readJSON<IPackageJson>(`${dir}/package.json`);
        const dependencias = {...paquete.dependencies, ...paquete.devDependencies};
        grafo.set(nombre, Object.entries(dependencias).filter(([dependencia, version]) => version.startsWith("workspace:") && nombres.has(dependencia)).map(([dependencia]) => dependencia));
    }
    return grafo;
}

/**
 * Indica si un workspace, o algo de lo que depende por el protocolo `workspace:` (recursivamente), declara su topología de
 * Pub/Sub. Es lo que decide si un servicio recibe su acción «ejecutar + pubsub»: sus dependencias son las que hacen que
 * publique o consuma.
 *
 * Tolera ciclos. Sin ningún workspace con declaración, la respuesta es siempre `false`.
 *
 * @param nombre - Nombre (del `package.json`) del workspace.
 * @param grafo - Dependencias de cada workspace en otros workspaces (ver {@link grafoDependencias}).
 * @param conDeclaracion - Nombres de los workspaces con `mrpack.pubsub.ts`.
 * @returns `true` si su clausura de dependencias, él incluido, contiene algún workspace con declaración.
 */
export function alcanzaDeclaracion(nombre: string, grafo: ReadonlyMap<string, readonly string[]>, conDeclaracion: ReadonlySet<string>): boolean {
    const visitados = new Set<string>();
    const pendientes = [nombre];
    for (let actual = pendientes.pop(); actual !== undefined; actual = pendientes.pop()) {
        if (conDeclaracion.has(actual)) {
            return true;
        }
        if (!visitados.has(actual)) {
            visitados.add(actual);
            pendientes.push(...(grafo.get(actual) ?? []));
        }
    }
    return false;
}

/**
 * Genera en `{basedir}/.run/` una acción de depuración (`{type}-{service}.run.xml`) para cada
 * workspace cuyo `deploy.type` sea `service`/`cronjob`/`job`, esté habilitado
 * (`enabled` + `devel.enabled`) y use el framework `meteored`, permitiendo depurarlo
 * individualmente desde el IDE.
 *
 * Si el monorepo tiene algún `mrpack.pubsub.ts`, genera además:
 * - Para cada una de esas acciones cuyo workspace dependa (por el protocolo `workspace:`, recursivamente, él incluido) de algún
 *   workspace con declaración, `{type}-{service}.pubsub.run.xml` («ejecutar + pubsub»): `devel -e -p --solo={service}`.
 * - Las cuatro acciones de la raíz de {@link RUN_MRPACK_PUBSUB} (ejecutar, compilar + ejecutar, estado y reset).
 *
 * Si el directorio no existe se crea. Si ya existe, se regenera su contenido: se eliminan las
 * acciones de workspaces que ya no existen o que han dejado de cumplir las condiciones anteriores
 * (incluidas las de Pub/Sub de un repo que se ha quedado sin declaraciones), y se (re)escriben las vigentes.
 *
 * @param basedir    - Raíz absoluta del monorepo.
 * @param workspaces - Agrupación de workspaces por directorio (`cronjobs`, `jobs`, `services`, `scripts`).
 */
export async function initRun(basedir: string, workspaces: IWorkspaces[]): Promise<void> {
    Log.group({type: Log.label_base, label: "run"}, Colors.colorize([Colors.FgWhite], "Generando acciones de depuración (.run)"));

    const declarados = await buscarDeclaraciones(basedir);
    const locales = declarados.length>0 ? await workspacesDelMonorepo(basedir) : [];
    const grafo = await grafoDependencias(locales);
    const nombres = new Map(locales.map(({dir, nombre})=>[dir, nombre]));
    const conDeclaracion = new Set(declarados.flatMap(workspace=>nombres.get(`${basedir}/${workspace}`) ?? []));

    const esperados = new Map<string, string>();
    for (const carpeta of workspaces) {
        for (const service of carpeta.workspaces) {
            const {manifest} = new ManifestWorkspaceLoader(`${basedir}/${carpeta.dir}/${service}`).loadSync();
            const type = manifest.deploy.type;
            if (!TIPOS.includes(type) || !manifest.enabled || !manifest.devel.enabled || manifest.build.framework!==BuildFW.meteored) {
                continue;
            }

            esperados.set(`${type}-${service}.run.xml`, RUN({type, service}));

            const nombre = nombres.get(`${basedir}/${carpeta.dir}/${service}`);
            if (nombre!==undefined && alcanzaDeclaracion(nombre, grafo, conDeclaracion)) {
                esperados.set(`${type}-${service}.pubsub.run.xml`, runPubSub({type, service}));
            }
        }
    }
    if (declarados.length>0) {
        for (const accion of RUN_MRPACK_PUBSUB) {
            esperados.set(accion.fichero, runMrpack(accion));
        }
    }

    const dir = `${basedir}/.run`;
    if (await isDir(dir)) {
        for (const fichero of await readDir(dir)) {
            if (REGEX_FICHERO.test(fichero) && !esperados.has(fichero)) {
                Log.info({type: Log.label_base, label: "run"}, Colors.colorize([Colors.FgYellow], `Eliminando ${fichero}`));
                await unlink(`${dir}/${fichero}`);
            }
        }
    } else {
        await mkdir(dir);
    }

    for (const [fichero, contenido] of esperados) {
        await safeWrite(`${dir}/${fichero}`, contenido, true);
    }

    Log.groupEnd();
}
