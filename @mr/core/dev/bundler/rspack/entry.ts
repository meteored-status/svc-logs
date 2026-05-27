/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 21 May 2026 06:51:30 GMT
 * Hash: 04a37d9fea5008c1b5d5ba1856bad67c
 * Versión: 2026.5.21+1-josantoniojimnez
 */

import type {Entry as TEntry} from "@rspack/core";
import {createRequire} from 'node:module';

import {BuildFW} from "@mr/core-dev/manifest/build";
import {Runtime} from "@mr/core-dev/manifest/deployment";

const require = createRequire(import.meta.url);

/**
 * Configuración de entradas para el bundle.
 *
 * @property basedir - Directorio raíz del workspace.
 * @property entries - Mapa `{ nombre: ruta }` de entradas extra (usado en bundles browser).
 */
interface IEntryConfig {
    basedir: string;
    entries?: Record<string, string>;
}

/**
 * Construye la entrada para un bundle Node.js con el framework Meteored.
 * El único punto de entrada es `${basedir}/main.ts`, publicado como `"app"`.
 */
function buildNodeMeteored({basedir}: IEntryConfig): TEntry {
    return {
        app: `${basedir}/main.ts`,
    };
}

/**
 * Construye las entradas para un bundle browser a partir del mapa `entries`.
 *
 * - Rutas que empiezan por `/` o `.` se resuelven como `${basedir}${value}`.
 * - Nombres de módulo se resuelven con `require.resolve` desde `basedir`.
 */
function buildBrowser({basedir, entries = {}}: IEntryConfig): TEntry {
    const salida: TEntry = {};

    for (const [key, value] of Object.entries(entries)) {
        if (value === undefined) {
            continue;
        }
        if (value.startsWith("/") || value.startsWith(".")) {
            salida[key] = `${basedir}${value}`;
        } else {
            salida[key] = require.resolve(value, {
                paths: [basedir],
            });
        }
    }

    return salida;
}

/**
 * Selecciona la estrategia de entradas en función del `runtime` y el `framework`.
 *
 * | Runtime   | Framework    | Comportamiento |
 * |-----------|--------------|----------------|
 * | `node`    | `meteored`   | Entrada única `app → main.ts`. |
 * | `node`    | `nextjs`     | Sin entradas; Next.js gestiona el bundling. |
 * | `browser` | cualquiera   | Entradas tomadas de `bundle.entries`. Rutas absolutas/relativas se resuelven respecto a `basedir`; nombres de módulo se resuelven con `require.resolve`. |
 *
 * @param runtime   - Runtime del bundle.
 * @param framework - Framework de compilación.
 * @param config    - Configuración de entradas.
 * @throws {Error} Si el runtime o el framework no están soportados.
 */
export function Entry(runtime: Runtime, framework: BuildFW, config: IEntryConfig): TEntry {
    switch (runtime) {
        case Runtime.node:
            switch (framework) {
                case BuildFW.meteored:
                    return buildNodeMeteored(config);
                case BuildFW.nextjs:
                    return {};
                default:
                    throw new Error(`Framework no soportado: ${framework}`);
            }
        case Runtime.browser:
            return buildBrowser(config);
        default:
            throw new Error(`Runtime no soportado: ${runtime}`);
    }
}
