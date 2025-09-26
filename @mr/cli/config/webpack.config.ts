import {isFileSync, readJSONSync} from "services-comun/modules/utiles/fs";

import {Configuracion} from "./configuracion";
import type {Manifest} from "../manifest/workspace";
import {ManifestWorkspaceLoader} from "../src/mrpack/clases/manifest/workspace";
import {Runtime} from "../manifest/workspace/deployment";

interface IEnv {
    entorno: string;
    dir: string;
}

interface IConfiguracion {
    config: Manifest;
    dependencies: Record<string, string>;
}

export default (env: IEnv)=>{
    const {entorno, dir: basedir} = env;
    const {dependencies} = readJSONSync<IConfiguracion>(`${basedir}/package.json`) as IConfiguracion;
    const {manifest} = new ManifestWorkspaceLoader(basedir).loadSync();

    const rules = isFileSync(`${basedir}/rules.js`) ? `${basedir}/rules.js` : undefined;
    const database = env.entorno==="produccion" ?
        manifest.build.database?.produccion :
        manifest.build.database?.test;

    return [
        Configuracion.build({
            basedir,
            bundle: manifest.build.bundle,
            dependencies,
            entorno,
            framework: manifest.build.framework,
            runtime: manifest.deploy.runtime,
            database,
            rules,
        }),
        ...manifest.build.bundle.web.map(bundle=>Configuracion.build({
            basedir,
            bundle,
            dependencies,
            entorno,
            framework: manifest.build.framework,
            runtime: Runtime.browser,
            rules,
        })),
    ];
}
