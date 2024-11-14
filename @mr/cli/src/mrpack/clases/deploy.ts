import {isDir, isFile, readDir, readFileString} from "services-comun/modules/utiles/fs";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";

import {Comando} from "./comando";
import {Compilar} from "./workspace/compilar";

export class Deploy {
    /* STATIC */
    public static run(basedir: string, env: string): void {
        PromiseDelayed()
            .then(async ()=>{
                const services = await readDir(`${basedir}/services/`);

                const fecha = await this.fechaCommit(basedir);

                const compilaciones = await Promise.all(services.map((service)=>Compilar.build(basedir, service, fecha)));
                const compilaciones_validas = compilaciones.filter((compilacion)=>compilacion!=null);
                compilaciones_validas.forEach((compilacion)=>{
                    compilacion.checkDependencias(compilaciones_validas);
                });

                if (await isDir(`${basedir}/i18n`)) {
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
                    Compilar.md5Deps(basedir),
                    ...compilaciones_validas.filter(service=>!service.dependiente).map((service)=>service.pack(env)),
                ]);
            })
            .catch((error)=>{
                if (error!=undefined) {
                    console.error(error);
                }
                process.exit(1);
            });
    }

    public static async fechaCommit(basedir: string): Promise<Date> {
        if (await isFile(`${basedir}/last_commit.txt`)) {
            const fecha = await readFileString(`${basedir}/last_commit.txt`);
            return new Date(fecha.trim());
        }

        return new Date(0);
    }

    /* INSTANCE */
}
