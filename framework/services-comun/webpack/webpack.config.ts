import {Configuracion} from "./configuracion";
import {ERuntime, IConfigService} from "../tools/src/clases/workspace/service";
import {readJSONSync} from "../modules/utiles/fs";

interface IEnv {
    entorno: string;
    dir: string;
}

interface IConfiguracion {
    config: IConfigService;
    dependencies: NodeJS.Dict<string>;
}

export default (env: IEnv)=>{
    const {entorno, dir: basedir} = env;
    const {
        config: {
            runtime,
            framework,
            bundle: {
                web = [],
                ...bundle
            },
        },
        dependencies,
    } = readJSONSync<IConfiguracion>(`${basedir}/package.json`) as IConfiguracion;

    const webFinal = Array.isArray(web) ? web : [web];

    return [
        Configuracion.build({
            basedir,
            bundle,
            dependencies,
            entorno,
            framework,
            runtime,
        }),
        ...webFinal.map(bundle=>Configuracion.build({
            basedir,
            bundle,
            dependencies,
            entorno,
            framework,
            runtime: ERuntime.browser,
        })),
    ];
}
