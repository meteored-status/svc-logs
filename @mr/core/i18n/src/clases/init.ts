/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 30198b285fc3012c230326df38ad8fb3
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {soportados} from "../../modules/langs";

import {isDir, mkdir, readDir, readJSON, safeWrite} from "@mr/core-cli/fs";
import {Colors} from "@mr/core-cli/colors";
import type {IPackageConfig} from "./modulo";

/**
 * Si el proyecto genera con el generador v2, leyéndolo de su propio script `generate`.
 *
 * Acepta las dos formas del flag —`-v2`, `-v 2`, `--version=2`, `--version 2`— en vez de comparar
 * la cadena entera, que es lo que hacía antes: bastaba un espacio de más, o que el script llevara
 * cualquier otra cosa detrás, para que el proyecto pasara por v1 y se le reescribiera el
 * `generate` quitándole el `-v2`.
 *
 * Sin script previo no hay proyecto previo: un alta nueva se trata como v1, que es el generador
 * por defecto de `mrlang generate`.
 */
function esV2(generate?: string): boolean {
    return generate!=undefined && /(?:^|\s)(?:-v\s*2|--version[=\s]2)(?:\s|$)/.test(generate);
}

export class Init {
    /* STATIC */
    public static async run(basedir: string): Promise<void> {
        const i18n = `${basedir}/i18n`;

        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/"));
        await mkdir(i18n);

        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/.json/"));
        await mkdir(`${i18n}/.json`);

        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/.run/"));
        await mkdir(`${i18n}/.run`);

        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/.run/generate.run.xml"));
        await safeWrite(`${i18n}/.run/generate.run.xml`, "<component name=\"ProjectRunConfigurationManager\">\n" +
            "    <configuration default=\"false\" name=\"i18n => Generar (forzar)\" type=\"js.build_tools.npm\">\n" +
            "        <package-json value=\"$PROJECT_DIR$/i18n/package.json\" />\n" +
            "        <command value=\"run\" />\n" +
            "        <scripts>\n" +
            "            <script value=\"generate\" />\n" +
            "        </scripts>\n" +
            "        <node-interpreter value=\"project\" />\n" +
            "        <envs />\n" +
            "        <method v=\"2\" />\n" +
            "    </configuration>\n" +
            "</component>", true);

        const {scripts={}, devDependencies={}, config} = await readJSON<{ scripts?: Record<string, string>, devDependencies?: Record<string, string>, config: IPackageConfig }>(`${i18n}/package.json`).catch(()=>({config: {lang: "en", langs: soportados, modulos: {}}} as { scripts?: Record<string, string>, devDependencies?: Record<string, string>, config: IPackageConfig }));

        // Qué generador usa el proyecto sale de su propio script `generate`, que es el único sitio
        // donde está escrito. Decide dos cosas de aquí abajo, y las dos por el mismo motivo: el
        // código que produce v2 no menciona `services-comun` en ningún punto, y el de v1 sí
        // —importa su runtime de traducciones—.
        const v2 = esV2(scripts["generate"]);

        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/tsconfig.json"));
        await safeWrite(`${i18n}/tsconfig.json`, JSON.stringify({
            // El de `services-comun` es un reenvío de una línea, así que en v2 se extiende el de
            // `@mr/core-i18n` —que el workspace ya necesita por el runtime— y con eso deja de
            // depender de `services-comun` sin ganar ninguna dependencia nueva a cambio.
            extends: v2 ? "@mr/core-i18n/tsconfig.json" : "services-comun/tsconfig.json",
        }, null, 2), true);

        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/package.json"));
        await safeWrite(`${i18n}/package.json`, JSON.stringify({
            name: "i18n",
            description: "Componentes de Traducción",
            version: "1.0.0",
            author: "José Antonio Jiménez",
            scripts: {
                "generate": v2 ? "yarn workspace @mr/core-i18n mrlang generate -v2" : "yarn workspace @mr/core-i18n mrlang generate",
            },
            devDependencies: {
                // El runtime de traducciones que importa todo lo que se genera en `.src/`.
                "@mr/core-i18n": "workspace:*",
                // v1 genera código que importa `services-comun/modules/traduccion/*`; v2 no
                // menciona el paquete en ningún punto, así que no se declara.
                ...v2 ? {} : {"services-comun": "workspace:*"},
                "tslib": devDependencies["tslib"]??"^2.7.0",
            },
            config,
        }, null, 2)+"\n", true);

        async function updateDir(dir: string): Promise<void> {
            console.log(Colors.colorize([Colors.FgGreen], `Actualizando /${dir}/package.json`));
            const data = await readJSON(`${basedir}/${dir}/package.json`);
            if (data.devDependencies==undefined) {
                data.devDependencies = {
                    i18n: "workspace:*",
                };
            } else {
                data.devDependencies.i18n = "workspace:*";
            }
            await safeWrite(`${basedir}/${dir}/package.json`, `${JSON.stringify(data, null, 2)}\n`, true);
        }

        if (await isDir(`${basedir}/packages`)) {
            for (const dir of await readDir(`${basedir}/packages`)) {
                await updateDir(`packages/${dir}`);
            }
        }

        if (await isDir(`${basedir}/services`)) {
            for (const dir of await readDir(`${basedir}/services`)) {
                await updateDir(`services/${dir}`);
            }
        }

        console.log(Colors.colorize([Colors.FgGreen], `Actualizando /package.json`));
        const paquete = await readJSON(`${basedir}/package.json`);
        paquete.scripts.i18n = "yarn workspace i18n";
        await safeWrite(`${basedir}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
    }

    /* INSTANCE */
}
