/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: de09bff477868df3e695690913eeeae0
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+2-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BuildFW} from "@mr/core-dev/manifest/build";
import {ManifestDeploymentKind} from "@mr/core-dev/manifest/deployment";

import {isDir, mkdir, readDir, safeWrite, unlink} from "@mr/core-cli/fs";
import {Colors} from "@mr/core-cli/colors";
import {Log} from "../log";
import {ManifestWorkspaceLoader} from "../manifest/workspace";
import type {IWorkspaces} from "./config-workspaces";

/** Tipos de despliegue para los que se genera una acción de depuración. */
const TIPOS: ManifestDeploymentKind[] = [ManifestDeploymentKind.SERVICE, ManifestDeploymentKind.CRONJOB, ManifestDeploymentKind.JOB];

/** Nombre de fichero de una acción de depuración generada por {@link initRun}. */
const REGEX_FICHERO = /^(?:service|cronjob|job)-.+\.run\.xml$/;

interface IRunTemplate {
    type: ManifestDeploymentKind;
    service: string;
}

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

/**
 * Genera en `{basedir}/.run/` una acción de depuración (`{type}-{service}.run.xml`) para cada
 * workspace cuyo `deploy.type` sea `service`/`cronjob`/`job`, esté habilitado
 * (`enabled` + `devel.enabled`) y use el framework `meteored`, permitiendo depurarlo
 * individualmente desde el IDE.
 *
 * Si el directorio no existe se crea. Si ya existe, se regenera su contenido: se eliminan las
 * acciones de workspaces que ya no existen o que han dejado de cumplir las condiciones anteriores,
 * y se (re)escriben las vigentes.
 *
 * @param basedir    - Raíz absoluta del monorepo.
 * @param workspaces - Agrupación de workspaces por directorio (`cronjobs`, `jobs`, `services`, `scripts`).
 */
export async function initRun(basedir: string, workspaces: IWorkspaces[]): Promise<void> {
    Log.group({type: Log.label_base, label: "run"}, Colors.colorize([Colors.FgWhite], "Generando acciones de depuración (.run)"));

    const esperados = new Map<string, string>();
    for (const carpeta of workspaces) {
        for (const service of carpeta.workspaces) {
            const {manifest} = new ManifestWorkspaceLoader(`${basedir}/${carpeta.dir}/${service}`).loadSync();
            const type = manifest.deploy.type;
            if (!TIPOS.includes(type) || !manifest.enabled || !manifest.devel.enabled || manifest.build.framework!==BuildFW.meteored) {
                continue;
            }

            esperados.set(`${type}-${service}.run.xml`, RUN({type, service}));
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
