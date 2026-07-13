import {BuildBundler, BuildFW} from "@mr/core-dev/manifest/build";
import type {Manifest} from "@mr/core-dev/manifest";
import {Runtime} from "@mr/core-dev/manifest/deployment";

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
            if (config.build.bundle.toJSON()?.componentes!=undefined && Object.keys(config.build.bundle.toJSON()?.componentes ?? {}).length>0) {
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
