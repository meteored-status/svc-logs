/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 6d946db746d7d11a683fc6f04b56e5ed
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
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

            const compilaciones = await Promise.all(
                GRUPOS.flatMap((grupo)=>workspacesPorGrupo[grupo].map((service)=>Compilar.build(basedir, service, grupo))),
            );
            const compilaciones_validas = compilaciones.filter((compilacion)=>compilacion!=null);
            compilaciones_validas.forEach((compilacion)=>{
                compilacion.checkDependencias(compilaciones_validas);
            });

            if (manifest.deploy.build.enabled && await isDir(`${basedir}/i18n`)) {
                const {status, stdout, stderr} = await Comando("yarn", ["workspace", "i18n", "run", "generate"]);
                if (status != 0) {
                    Log.error({type: Log.label_compilar, label: "i18n"}, "Error compilando:", stdout, stderr);
                    return Promise.reject();
                }
                Log.info({type: Log.label_compilar, label: "i18n"}, "Traducciones generadas");
            }

            // eliminamos las compilaciones dependientes de otras compilaciones (serán iniciadas por las propias dependencias)
            await Promise.all([
                manifest.deploy.build.enabled ? Compilar.md5Deps(basedir) : Promise.resolve(),
                ...compilaciones_validas.filter(service => !service.dependiente).map((service) => service.pack(env, manifest)),
            ]);
        })
        .catch((error)=>{
            if (error!==undefined) {
                Log.error({type: Log.label_base, label: "deploy"}, error);
            }
            process.exit(1);
        });
}
