import {isFileSync, readJSONSync} from "services-comun/modules/utiles/fs";

import {Configuracion} from "./configuracion";
import {ERuntime, IConfigService} from "../src/mrpack/clases/workspace/service";

interface IEnv {
    entorno: string;
    dir: string;
}

interface IConfiguracion {
    config: IConfigService;
    dependencies: Record<string, string>;
}

export default (env: IEnv)=>{
    const {entorno, dir: basedir} = env;
    const {
        config: {
            runtime,
            framework,
            database,
            bundle: {
                web = [],
                ...bundle
            },
        },
        dependencies,
    } = readJSONSync<IConfiguracion>(`${basedir}/package.json`) as IConfiguracion;

    const rules = isFileSync(`${basedir}/rules.js`) ? `${basedir}/rules.js` : undefined;

    const webFinal = Array.isArray(web) ? web : [web];

    return [
        Configuracion.build({
            basedir,
            bundle,
            dependencies,
            entorno,
            framework,
            runtime,
            database,
            rules,
        }),
        ...webFinal.map(bundle=>Configuracion.build({
            basedir,
            bundle,
            dependencies,
            entorno,
            framework,
            runtime: ERuntime.browser,
            rules,
        })),
    ];
}
