import {Compilar} from "./workspace/compilar";
import {PromiseDelayed} from "../../../modules/utiles/promise";
import {readDir} from "../../../modules/utiles/fs";

export class Deploy {
    /* STATIC */
    public static run(basedir: string, env: string): void {
        PromiseDelayed()
            .then(async ()=>{
                const services = await readDir(`${basedir}/services/`);
                const compilaciones = await Promise.all(services.map((service)=>Compilar.build(basedir, service)));
                const compilaciones_validas = compilaciones.filter((compilacion)=>compilacion!=null) as Compilar[];
                compilaciones_validas.forEach((compilacion)=>{
                    compilacion.checkDependencias(compilaciones_validas);
                });

                await Promise.all([
                    Compilar.md5Deps(basedir),
                    ...compilaciones_validas.map((service)=>service.pack(env)),
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
