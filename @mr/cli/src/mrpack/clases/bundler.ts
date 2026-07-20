/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 20 Jul 2026 07:17:20 GMT
 * Hash: 357819bc83b2e5fb134e261960daf382
 * Versión: 2026.7.20+2-josantoniojimnez
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-cmp.git
 */

import {BuildBundler, BuildFW} from "@mr/core-dev/manifest/build";
import type {ManifestBuildBundle} from "@mr/core-dev/manifest/build/bundle";
import type {Manifest} from "@mr/core-dev/manifest";
import {Runtime} from "@mr/core-dev/manifest/deployment";

/**
 * Determina si el bundle requiere `rspack`: porque el bundle principal declara un pipeline de
 * `componentes` no vacío, o porque hay algún bundle web adicional (`bundle.web[]`) — esbuild no
 * soporta ninguno de los dos casos.
 *
 * @param bundle - Configuración de bundle del workspace (principal + `web[]`).
 * @returns `true` si el bundle principal tiene `componentes`, o si `web[]` tiene alguna entrada.
 */
function bundleRequiereRspack(bundle: ManifestBuildBundle): boolean {
    const principal = bundle.toJSON();
    if (principal?.componentes!=undefined && Object.keys(principal.componentes).length>0) {
        return true;
    }
    return bundle.web.length>0;
}

/**
 * Determina el bundler que debería usarse según el runtime/framework/build del workspace,
 * independientemente del bundler configurado actualmente.
 *
 * @param config       - Manifest del workspace.
 * @param dependencies - `dependencies` del `package.json` (usadas para detectar `reflect-metadata`).
 * @returns Bundler coherente con la configuración actual.
 */
export function getBundlerCoherente(config: Manifest, dependencies?: Record<string, string>): BuildBundler {
    switch (config.deploy.runtime) {
        case Runtime.browser:
            return BuildBundler.rspack;
        case Runtime.cfworker:
        case Runtime.php:
            return BuildBundler.none;
        case Runtime.node:
        default:
            if (config.build.framework===BuildFW.nextjs) {
                return BuildBundler.none;
            }
            if (bundleRequiereRspack(config.build.bundle)) {
                return BuildBundler.rspack;
            }
            if (dependencies?.["reflect-metadata"]!=undefined) {
                // esbuild no genera decoratorMetadata; rspack (swc-loader) sí lo soporta.
                return BuildBundler.rspack;
            }
            return BuildBundler.esbuild;
    }
}

/**
 * Normaliza el bundler esperado, preservando `rspack` si ya estaba configurado explícitamente
 * y el bundler coherente calculado fuese `esbuild` (evita downgrades no deseados).
 *
 * @param config       - Manifest del workspace.
 * @param dependencies - `dependencies` del `package.json`.
 * @returns Bundler normalizado.
 */
export function getBundlerNormalizado(config: Manifest, dependencies?: Record<string, string>): BuildBundler {
    const bundlerEsperado = getBundlerCoherente(config, dependencies);
    if (bundlerEsperado===BuildBundler.esbuild && config.build.bundler===BuildBundler.rspack) {
        return BuildBundler.rspack;
    }
    return bundlerEsperado;
}
