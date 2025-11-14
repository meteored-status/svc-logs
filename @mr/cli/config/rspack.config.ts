import {isFileSync, readJSONSync} from "services-comun/modules/utiles/fs";

import {Configuracion} from "./configuracion";
import {ManifestWorkspaceLoader} from "../src/mrpack/clases/manifest/workspace";
import {Runtime} from "../manifest/workspace/deployment";
import type {IPackageJsonLegacy} from "../src/mrpack/clases/packagejson";

interface IEnv {
    entorno: string;
    dir: string;
}

export default (env: IEnv)=>{
    const {entorno, dir: basedir} = env;
    const paquete = readJSONSync<IPackageJsonLegacy>(`${basedir}/package.json`);
    const {manifest} = new ManifestWorkspaceLoader(basedir).loadSync(paquete??undefined);

    const rules = isFileSync(`${basedir}/rules.js`) ? `${basedir}/rules.js` : undefined;
    const database = env.entorno==="produccion" ?
        manifest.build.database?.produccion :
        manifest.build.database?.test;

    return [
        Configuracion.build({
            basedir,
            bundle: manifest.build.bundle,
            dependencies: paquete?.dependencies??{},
            entorno,
            framework: manifest.build.framework,
            runtime: manifest.deploy.runtime,
            database,
            rules,
        }),
        ...manifest.build.bundle.web.map(bundle=>Configuracion.build({
            basedir,
            bundle,
            dependencies: paquete?.dependencies??{},
            entorno,
            framework: manifest.build.framework,
            runtime: Runtime.browser,
            rules,
        })),
    ];
}
