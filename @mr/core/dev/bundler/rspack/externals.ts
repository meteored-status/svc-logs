/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 21 May 2026 06:51:30 GMT
 * Hash: 62c9244bfc3579e4fde583b83e94df46
 * Versión: 2026.5.21+1-josantoniojimnez
 */

import type {Externals as TExternals} from "@rspack/core";

import {Runtime} from "@mr/core-dev/manifest/deployment";


/**
 * Paquetes npm que usan ESM nativo en la versión major indicada.
 * Si la dependencia en `package.json` coincide con esa major, se importa como `module`.
 */
const ES_MODULES: Record<string, string> = {
    "@inquirer/prompts": "8",
    "chokidar": "5",
    "formidable": "3",
    "mime": "4",
    "pdf-merger-js": "5",
    "uuid": "13",
};

/**
 * Comprueba si la versión declarada en `package.json` corresponde a la major indicada.
 * Acepta los rangos `^X.y.z`, `~X.y.z` y `X.y.z`.
 */
function checkVersion(actual: string, major: string): boolean {
    return actual.startsWith(`^${major}.`)
        || actual.startsWith(`~${major}.`)
        || actual.startsWith(`${major}.`);
}

/**
 * Construye los externals para un bundle Node.
 *
 * Cada dependencia (salvo las de `@mr/`) se añade como `commonjs <mod>` o `module <mod>`
 * según si es ESM nativo. Se añade también una función de externals que resuelve
 * sub-paths (p. ej. `formidable/src/...`) con el mismo tipo que su paquete raíz.
 */
function buildNode(dependencies: Record<string, string>): TExternals {
    const commonjs: string[] = [];
    const modules: string[] = [];
    const salida: TExternals = [];

    for (const mod of Object.keys(dependencies)) {
        if (mod.startsWith("@mr/")) {
            continue;
        }
        if (ES_MODULES[mod] === undefined || !checkVersion(dependencies[mod], ES_MODULES[mod])) {
            salida.push({[mod]: `commonjs ${mod}`});
            commonjs.push(mod);
        } else {
            salida.push({[mod]: `module ${mod}`});
            modules.push(mod);
        }
    }

    salida.push(({request}, callback) => {
        if (request == null) {
            return callback();
        }
        for (const mod of commonjs) {
            if (request.startsWith(mod)) {
                return callback(undefined, `commonjs ${request}`);
            }
        }
        for (const mod of modules) {
            if (request.startsWith(mod)) {
                return callback(undefined, `module ${request}`);
            }
        }
        callback();
    });

    return salida;
}

/** Los bundles browser no tienen externals; todo se empaqueta. */
function buildBrowser(): TExternals {
    return {};
}

/**
 * Genera la sección `externals` de la configuración de rspack.
 *
 * Para bundles **Node**, todas las dependencias del `package.json` se marcan como externas
 * (no se empaquetan). Las que estén en `ES_MODULES` con la versión major correcta se marcan
 * como `module`; el resto, como `commonjs`.
 *
 * Para bundles **browser** no hay externals: todo se empaqueta.
 *
 * @param runtime      - Runtime del bundle.
 * @param dependencies - Dependencias del `package.json` del workspace.
 * @throws {Error} Si el runtime no está soportado.
 */
export function Externals(runtime: Runtime, dependencies: Record<string, string> = {}): TExternals {
    switch (runtime) {
        case Runtime.node:
            return buildNode(dependencies);
        case Runtime.browser:
            return buildBrowser();
        default:
            throw new Error(`Runtime no soportado: ${runtime}`);
    }
}
