import {isDir, readDir} from "services-comun/modules/utiles/fs";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";

import {Comando} from "./comando";
import {Compilar} from "./workspace/compilar";
import {ManifestRootLoader} from "./manifest/root";

export class Deploy {
    /* STATIC */
    public static run(basedir: string, env: string): void {
        PromiseDelayed()
            .then(async ()=>{
                const cronjobs: string[] = [];
                const services: string[] = [];
                if (await isDir(`${basedir}/cronjobs/`)) {
                    cronjobs.push(...await readDir(`${basedir}/cronjobs/`));
                }
                if (await isDir(`${basedir}/services/`)) {
                    services.push(...await readDir(`${basedir}/services/`));
                }

                const {manifest} = await new ManifestRootLoader(basedir).load(true);
                // console.log(JSON.stringify(process.env));
                // console.log(JSON.stringify(manifest.toJSON()));

                const compilaciones = await Promise.all([
                    ...cronjobs.map((service)=>Compilar.build(basedir, service, "cronjobs")),
                    ...services.map((service)=>Compilar.build(basedir, service, "services")),
                ]);
                const compilaciones_validas = compilaciones.filter((compilacion)=>compilacion!=null);
                compilaciones_validas.forEach((compilacion)=>{
                    compilacion.checkDependencias(compilaciones_validas);
                });

                if (manifest.deploy.build.enabled && await isDir(`${basedir}/i18n`)) {
                    const {status, stdout, stderr} = await Comando.spawn("yarn", ["workspace", "i18n", "run", "generate"]);
                    if (status != 0) {
                        console.error("i18n", "[KO   ]", "Error compilando:");
                        console.error(stdout);
                        console.error(stderr);
                        return Promise.reject();
                    }
                    console.log("i18n", "[OK   ]", "Traducciones generadas");
                }

                // eliminamos las compilaciones dependientes de otras compilaciones (serán iniciadas por las propias dependencias)
                await Promise.all([
                    manifest.deploy.build.enabled ? Compilar.md5Deps(basedir) : Promise.resolve(),
                    ...compilaciones_validas.filter(service=>!service.dependiente).map((service)=>service.pack(env, manifest)),
                ]);
            })
            .catch((error)=>{
                if (error!=undefined) {
                    console.error(error);
                }
                process.exit(1);
            });
    }

    /* INSTANCE */
}
