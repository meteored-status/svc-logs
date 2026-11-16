/**
 * Editor: Bixus
 * Fecha: Wed, 11 Nov 2026 08:40:54 GMT
 * Hash: 090f97d53627d26814eb7adebdf7a9e0
 * Versión: 2026.11.11+1-bixus
 * Anterior: 2026.9.23+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {isDir, readDir} from "@mr/core-cli/fs";

import {Comando} from "./comando";
import {GRUPOS} from "./config/datos";
import {Log} from "./log";
import {Compilar} from "./workspace/compilar";
import {ManifestRootLoader} from "./manifest/root";

export function run(basedir: string, env: string): void {
    PromiseDelayed()
        .then(async ()=>{
            const workspacesPorGrupo: Record<string, string[]> = {};
            for (const grupo of GRUPOS) {
                workspacesPorGrupo[grupo] = await isDir(`${basedir}/${grupo}/`)
                    ? await readDir(`${basedir}/${grupo}/`)
                    : [];
            }

            const {manifest} = await new ManifestRootLoader(basedir).load(true);
            if (!manifest.deploy.build.enabled) {
                // En Cloud Build este caso ya no llega aquí: compilar.sh escribe la versión desplegada con
                // `mantener-version` sin arrancar `mrpack`.
                Log.info({type: Log.label_base, label: "deploy"}, "Generación desactivada (deploy.build.enabled o _GENERAR): no hay nada que compilar");
                return;
            }

            const compilaciones = await Promise.all(
                GRUPOS.flatMap((grupo)=>workspacesPorGrupo[grupo].map((service)=>Compilar.build(basedir, service, grupo))),
            );
            const compilacionesValidas = compilaciones.filter((compilacion)=>compilacion!=null);
            compilacionesValidas.forEach((compilacion)=>{
                compilacion.checkDependencias(compilacionesValidas);
            });

            if (await isDir(`${basedir}/i18n`)) {
                const {status, stdout, stderr} = await Comando("yarn", ["workspace", "i18n", "run", "generate"]);
                if (status != 0) {
                    Log.error({type: Log.label_compilar, label: "i18n"}, "Error compilando:", stdout, stderr);
                    return Promise.reject();
                }
                Log.info({type: Log.label_compilar, label: "i18n"}, "Traducciones generadas");
            }

            // eliminamos las compilaciones dependientes de otras compilaciones (serán iniciadas por las propias dependencias)
            await Promise.all([
                Compilar.md5Deps(basedir),
                ...compilacionesValidas.filter(service => !service.dependiente).map((service) => service.pack(env, manifest)),
            ]);
        })
        .catch((error)=>{
            if (error!==undefined) {
                Log.error({type: Log.label_base, label: "deploy"}, error);
            }
            process.exit(1);
        });
}
