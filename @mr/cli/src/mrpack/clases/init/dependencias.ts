/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 15e477f772dbff536f1463d5db513e36
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import type {Manifest} from "@mr/core-dev/manifest";
import {BuildFW} from "@mr/core-dev/manifest/build";

import {readJSON} from "../../../utiles/fs";
import type {IPackageJson as IPackageJsonBase} from "../packagejson";

/**
 * Normaliza `dependencies`/`devDependencies`/`optionalDependencies` de un workspace,
 * añadiendo/eliminando entradas según el runtime, framework y versiones por defecto
 * del monorepo (p.ej. `tslib`, `@mr/core-*`, `dd-trace`, dependencias de OpenTelemetry
 * obsoletas, dependencias específicas de modo `devel` como `chokidar`/`ws`).
 *
 * @param config              - Manifest del workspace.
 * @param dependencies        - `dependencies` del `package.json` (mutado in-place).
 * @param devDependencies     - `devDependencies` del `package.json` (mutado in-place).
 * @param optionalDependencies - `optionalDependencies` del `package.json` (mutado in-place).
 * @param defecto             - Mapa de versiones por defecto del monorepo para dependencias conocidas.
 */
export function checkDependencies(config: Manifest, dependencies: Record<string, string>, devDependencies: Record<string, string>, optionalDependencies: Record<string, string>, defecto: Record<string, string>): void {
    // let openTelemetry = false;
    if (devDependencies["tslib"]!=undefined) {
        dependencies["tslib"] = devDependencies["tslib"];
        delete devDependencies["tslib"];
    } else if (dependencies["tslib"]==undefined) {
        dependencies["tslib"] = "*";
    }
    if (devDependencies["@mr/core-dev"]===undefined) {
        devDependencies["@mr/core-dev"] = "workspace:*";
    }
    if (devDependencies["@mr/core-i18n"]===undefined) {
        devDependencies["@mr/core-i18n"] = "workspace:*";
    }
    if (devDependencies["@mr/core-network"]===undefined) {
        devDependencies["@mr/core-network"] = "workspace:*";
    }
    if (dependencies["@mr/core-network"]!==undefined) {
        delete dependencies["@mr/core-network"];
    }

    if (config.build.framework!=BuildFW.nextjs) {
        dependencies["source-map-support"] ??= defecto["source-map-support"]??"*";

        for (const [lib, version] of Object.entries(defecto)) {
            if (dependencies[lib] != undefined) {
                dependencies[lib] = version;
            }
            if (devDependencies[lib] != undefined) {
                devDependencies[lib] = version;
            }
        }
        if (!config.deploy.cronjob) {
            dependencies["chokidar"] ??= defecto["chokidar"]??"*";
            dependencies["hexoid"] ??= defecto["hexoid"]??"*";
            dependencies["formidable"] ??= defecto["formidable"]??"*";
            dependencies["ws"] ??= defecto["ws"]??"*";
            optionalDependencies["bufferutil"] ??= defecto["bufferutil"]??"*";

            if (dependencies["@google-cloud/trace-agent"] != undefined) {
                delete dependencies["@google-cloud/trace-agent"];
            }
            if (dependencies["@opentelemetry/context-async-hooks"] != undefined) {
                delete dependencies["@opentelemetry/context-async-hooks"];
            }
            if (devDependencies["formidable"] != undefined) {
                delete devDependencies["formidable"];
            }

            // openTelemetry = true;
        }

        if (devDependencies["source-map-support"] != undefined) {
            delete devDependencies["source-map-support"];
        }
    }
    if (dependencies["@google-cloud/opentelemetry-cloud-trace-exporter"]!=undefined) {
        delete dependencies["@google-cloud/opentelemetry-cloud-trace-exporter"];
    }
    if (dependencies["@opentelemetry/api"]!=undefined) {
        delete dependencies["@opentelemetry/api"];
    }
    if (dependencies["@opentelemetry/core"]!=undefined) {
        delete dependencies["@opentelemetry/core"];
    }
    if (dependencies["@opentelemetry/instrumentation"]!=undefined) {
        delete dependencies["@opentelemetry/instrumentation"];
    }
    if (dependencies["@opentelemetry/instrumentation-http"]!=undefined) {
        delete dependencies["@opentelemetry/instrumentation-http"];
    }
    if (dependencies["@opentelemetry/resources"]!=undefined) {
        delete dependencies["@opentelemetry/resources"];
    }
    if (dependencies["@opentelemetry/sdk-trace-base"]!=undefined) {
        delete dependencies["@opentelemetry/sdk-trace-base"];
    }
    if (dependencies["@opentelemetry/sdk-trace-node"]!=undefined) {
        delete dependencies["@opentelemetry/sdk-trace-node"];
    }
    if (dependencies["@opentelemetry/semantic-conventions"]!=undefined) {
        delete dependencies["@opentelemetry/semantic-conventions"];
    }
    dependencies["dd-trace"] ??= defecto["dd-trace"]??"*";

// return openTelemetry;
}

/**
 * Traduce el nombre npm de un paquete `@mr/*` a su ruta absoluta dentro del monorepo.
 *
 * - `@mr/core-X` → `{root}/@mr/core/X`
 * - `@mr/user-X` → `{root}/@mr/user/X`
 * - `@mr/cli`    → `{root}/@mr/cli`
 *
 * @param root   - Raíz absoluta del monorepo.
 * @param nombre - Nombre npm del paquete (p.ej. `@mr/core-dev`).
 * @returns Ruta absoluta del directorio del paquete, o `undefined` si no corresponde a un paquete `@mr/*`.
 */
function mrNombreADir(root: string, nombre: string): string | undefined {
    const coreMatch = nombre.match(/^@mr\/core-(.+)$/);
    if (coreMatch) return `${root}/@mr/core/${coreMatch[1]}`;
    const userMatch = nombre.match(/^@mr\/user-(.+)$/);
    if (userMatch) return `${root}/@mr/user/${userMatch[1]}`;
    if (nombre === "@mr/cli") return `${root}/@mr/cli`;
    return undefined;
}

/**
 * Compara dos rangos de versión npm y devuelve el más reciente.
 * Soporta prefijos `^`, `~`, `>=`, etc. Si alguno es `*`, prefiere el otro.
 *
 * @param a - Primer rango de versión.
 * @param b - Segundo rango de versión.
 * @returns El rango de versión más reciente entre `a` y `b`.
 */
function versionMasReciente(a: string, b: string): string {
    if (a === "*") return b;
    if (b === "*") return a;
    const parsear = (v: string): number[] =>
        v.replace(/^[^0-9]*/, "").split(/[-+]/)[0].split(".").map(n => parseInt(n, 10) || 0);
    const [aMaj, aMin = 0, aPat = 0] = parsear(a);
    const [bMaj, bMin = 0, bPat = 0] = parsear(b);
    if (bMaj !== aMaj) return bMaj > aMaj ? b : a;
    if (bMin !== aMin) return bMin > aMin ? b : a;
    return bPat > aPat ? b : a;
}

/**
 * Opciones de `resolverDepsTransitivas`.
 *
 * @property visitados - Conjunto de nombres de paquete ya procesados (evita ciclos).
 * @property campo     - Campo del `package.json` a recopilar (`dependencies` u `optionalDependencies`).
 */
export interface IResolverDepsTransitivasConfig {
    visitados?: Set<string>;
    campo?: "dependencies" | "optionalDependencies";
}

/**
 * Resuelve de forma recursiva las dependencias del campo indicado de todos los paquetes
 * `@mr/*` declarados como `devDependencies`, sin referencias circulares.
 *
 * @param root    - Raíz absoluta del monorepo.
 * @param devDeps - Mapa de devDependencies del paquete a analizar.
 * @param config  - Opciones: conjunto de nombres ya procesados y campo a recopilar.
 * @returns Mapa de dependencias acumuladas.
 */
export async function resolverDepsTransitivas(root: string, devDeps: Record<string, string>, config: IResolverDepsTransitivasConfig = {}): Promise<Record<string, string>> {
    const {visitados = new Set<string>(), campo = "dependencies"} = config;
    const resultado: Record<string, string> = {};

    for (const nombre of Object.keys(devDeps)) {
        if (!nombre.startsWith("@mr/")) continue;
        if (visitados.has(nombre)) continue;
        visitados.add(nombre);

        const dir = mrNombreADir(root, nombre);
        if (dir === undefined) continue;

        const pkg = await readJSON<IPackageJsonBase>(`${dir}/package.json`).catch(() => undefined);
        if (pkg === undefined) continue;

        for (const [dep, version] of Object.entries(pkg[campo] ?? {})) {
            if (dep.startsWith("@mr/")) continue;
            if (version.startsWith("workspace:")) continue;
            resultado[dep] = resultado[dep] !== undefined
                ? versionMasReciente(resultado[dep], version)
                : version;
        }

        const transitivas = await resolverDepsTransitivas(root, pkg.devDependencies ?? {}, {visitados, campo});
        for (const [dep, version] of Object.entries(transitivas)) {
            resultado[dep] = resultado[dep] !== undefined
                ? versionMasReciente(resultado[dep], version)
                : version;
        }
    }

    return resultado;
}

export {versionMasReciente};
