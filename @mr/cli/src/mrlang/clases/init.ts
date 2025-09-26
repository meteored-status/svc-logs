import {isDir, mkdir, readDir, readJSON, safeWrite} from "services-comun/modules/utiles/fs";
import {soportados} from "services-comun/modules/net/i18n";

import {Colors} from "../../mrpack/clases/colors";
import type {IPackageConfig} from "./modulo";

export class Init {
    /* STATIC */
    public static async run(basedir: string): Promise<void> {
        const i18n = `${basedir}/i18n`;

        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/"));
        await mkdir(i18n, true);

        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/.credenciales/"));
        await mkdir(`${i18n}/.credenciales`, true);

        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/.json/"));
        await mkdir(`${i18n}/.json`, true);

        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/.run/"));
        await mkdir(`${i18n}/.run`, true);

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
        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/.run/pull.run.xml"));
        await safeWrite(`${i18n}/.run/pull.run.xml`, "<component name=\"ProjectRunConfigurationManager\">\n" +
            "    <configuration default=\"false\" name=\"i18n => PULL\" type=\"js.build_tools.npm\">\n" +
            "        <package-json value=\"$PROJECT_DIR$/i18n/package.json\" />\n" +
            "        <command value=\"run\" />\n" +
            "        <scripts>\n" +
            "            <script value=\"pull\" />\n" +
            "        </scripts>\n" +
            "        <node-interpreter value=\"project\" />\n" +
            "        <envs />\n" +
            "        <method v=\"2\" />\n" +
            "    </configuration>\n" +
            "</component>", true);
        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/.run/push.run.xml"));
        await safeWrite(`${i18n}/.run/push.run.xml`, "<component name=\"ProjectRunConfigurationManager\">\n" +
            "    <configuration default=\"false\" name=\"i18n => PUSH\" type=\"js.build_tools.npm\">\n" +
            "        <package-json value=\"$PROJECT_DIR$/i18n/package.json\" />\n" +
            "        <command value=\"run\" />\n" +
            "        <scripts>\n" +
            "            <script value=\"push\" />\n" +
            "        </scripts>\n" +
            "        <node-interpreter value=\"project\" />\n" +
            "        <envs />\n" +
            "        <method v=\"2\" />\n" +
            "    </configuration>\n" +
            "</component>", true);

        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/tsconfig.json"));
        await safeWrite(`${i18n}/tsconfig.json`, JSON.stringify({
            extends: "services-comun/tsconfig.json",
        }, null, 2), true);

        console.log(Colors.colorize([Colors.FgGreen], "Creando /i18n/package.json"));
        const {devDependencies={}, config} = await readJSON<{ devDependencies?: Record<string, string>, config: IPackageConfig }>(`${i18n}/package.json`).catch(()=>({config: {lang: "en", langs: soportados, modulos: {}}} as { devDependencies?: Record<string, string>, config: IPackageConfig }));
        await safeWrite(`${i18n}/package.json`, JSON.stringify({
            name: "i18n",
            description: "Componentes de Traducción",
            version: "1.0.0",
            author: "José Antonio Jiménez",
            scripts: {
                "generate": "yarn workspace @mr/cli mrlang generate",
                "pull": "yarn workspace @mr/cli mrlang pull",
                "push": "yarn workspace @mr/cli mrlang push",
            },
            devDependencies: {
                "make-plural": devDependencies["make-plural"]??"^7.4.0",
                "services-comun": "workspace:*",
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
