/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 17 Jul 2026 10:46:55 GMT
 * Hash: 185e75d3cb24c520c2422b4032cd0ce4
 * Versión: 2026.7.17+1-josantoniojimnez
 * Anterior: 2026.5.21+4-chema
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {type IManifest, Manifest} from "@mr/core-dev/manifest";
import {existsSync, type PathLike, type PathOrFileDescriptor, readFileSync, statSync} from "node:fs";

import {Runtime} from "@mr/core-dev/manifest/deployment";

import configuracion from "./configuracion.ts";


export function isFileSync(file: PathLike): boolean {
    return existsSync(file) && statSync(file).isFile();
}

export function readJSONSync<T=any>(file: PathOrFileDescriptor): T|null {
    try {
        return JSON.parse(readFileSync(file).toString("utf-8")) as T;
    } catch (e) {
        return null;
    }
}

/**
 * Variables de entorno inyectadas por el CLI de rspack.
 *
 * @property entorno - Nombre del entorno de compilación (`"desarrollo"`, `"test"`, `"produccion"`…).
 * @property dir     - Ruta absoluta al directorio raíz del workspace que se está compilando.
 * @property watch   - Si `"true"`, activa el modo watch. Por defecto, compila una única vez.
 */
interface IEnv {
    entorno: string;
    dir: string;
    watch?: string|boolean;
}

/**
 * Subconjunto del `package.json` que esta configuración necesita leer.
 *
 * @property dependencies - Dependencias de producción (usadas para calcular `externals`).
 */
interface IPackageJson {
    dependencies: Record<string, string>;
}

/**
 * Punto de entrada de rspack para el monorepo.
 *
 * Lee `mrpack.json` y `package.json` del workspace indicado por `env.dir` y devuelve
 * un array de configuraciones:
 *
 * 1. **Bundle principal** — usa el `runtime` declarado en `mrpack.json` (normalmente `node`).
 * 2. **Bundles web** — uno por cada entrada en `manifest.build.bundle.web`, compilados
 *    siempre con `Runtime.browser`.
 *
 * > **Nota sobre `dir`:** cuando rspack recibe la ruta a través de `--env dir=...` desde la
 * > línea de comandos, en determinados entornos (Windows, rutas con espacios o según la shell)
 * > puede envolver el valor entre comillas dobles. Por eso `dir` se sanitiza con
 * > `replaceAll('"', "")` antes de usarla como ruta base.
 *
 * @param env - Variables de entorno de rspack.
 * @returns Array de configuraciones de rspack.
 */
export default (env: IEnv) => {
    const {entorno, watch, ...resto} = env;
    // Elimina posibles comillas dobles que rspack inyecta al pasar --env dir="..." por CLI.
    const basedir = resto.dir.replaceAll('"', "");
    const watchHabilitado = watch === true || watch === "true";
    const paquete = readJSONSync<IPackageJson>(`${basedir}/package.json`);
    if (paquete === null) {
        throw new Error(`No se encontró package.json en: ${basedir}`);
    }
    const mrpack = readJSONSync<IManifest>(`${basedir}/mrpack.json`);
    if (mrpack === null) {
        throw new Error(`No se encontró mrpack.json en: ${basedir}`);
    }
    const manifest = new Manifest(mrpack);
    const rules = isFileSync(`${basedir}/rules.js`) ? `${basedir}/rules.js` : undefined;
    const database = entorno === "produccion"
        ? manifest.build.database?.produccion
        : manifest.build.database?.test;

    return [
        configuracion({
            basedir,
            bundle: manifest.build.bundle,
            dependencies: paquete.dependencies ?? {},
            entorno,
            watch: watchHabilitado,
            framework: manifest.build.framework,
            runtime: manifest.deploy.runtime,
            database,
            rules,
        }),
        ...manifest.build.bundle.web.map((bundle) => configuracion({
            basedir,
            bundle,
            dependencies: paquete.dependencies ?? {},
            entorno,
            watch: watchHabilitado,
            framework: manifest.build.framework,
            runtime: Runtime.browser,
            rules,
        })),
    ];
};
