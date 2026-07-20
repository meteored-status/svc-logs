/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 17 Jul 2026 10:46:55 GMT
 * Hash: 89c91bb711457b1abeea67843f754398
 * Versión: 2026.7.17+1-josantoniojimnez
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {BuildBundler, BuildFW} from "@mr/core-dev/manifest/build";
import type {Manifest} from "@mr/core-dev/manifest";
import {Runtime} from "@mr/core-dev/manifest/deployment";

import {getBundlerNormalizado} from "../bundler";

/**
 * Normaliza los scripts npm (`packd`, `devel`, `dev`) del `package.json` de un workspace
 * en función del runtime/framework/bundler configurados en su manifest.
 *
 * @param config       - Manifest del workspace (se actualiza `build.bundler` in-place).
 * @param scripts      - Objeto `scripts` del `package.json` (se muta in-place).
 * @param dependencies - `dependencies` del `package.json`.
 */
export function checkScripts(config: Manifest, scripts: Record<string, string>, dependencies?: Record<string, string>): void {
    const getNextJSPort = (script: string|undefined): string => {
        if (script==undefined) {
            return "8080";
        }
        const actual = script.match(/(?:^|\s)NEXTJS_PORT=(\d+)(?=\s|$)/);
        if (actual!=undefined) {
            return actual[1];
        }
        const legacy = script.match(/next\s+dev\b.*?(?:-p|--port)[=\s]+(\d+)/);
        if (legacy!=undefined) {
            return legacy[1];
        }
        return "8080";
    };
    config.build.bundler = getBundlerNormalizado(config, dependencies);
    switch(config.deploy.runtime) {
        case Runtime.cfworker:
            scripts["packd"] = `yarn tsc --noemit`;
            // scripts["devel"] = "wrangler dev --remote --env test";
            scripts["devel"] = "wrangler dev -e test --ip local.tiempo.com --port 3500 --local-protocol https --https-cert-path ./files/fullchain.pem --https-key-path ./files/privkey.pem";
            return;
        case Runtime.node:
            if (config.build.framework===BuildFW.nextjs) {
                const nextJSPort = getNextJSPort(scripts["dev"]);
                scripts["dev"] = `NEXTJS_PORT=${nextJSPort} yarn g:nextjs`;
                delete scripts["packd"];
                return;
            }
            scripts["packd"] = config.build.bundler===BuildBundler.esbuild ? "yarn g:esbuild" : "yarn g:rspack";
            if (!config.deploy.cronjob) {
                scripts["devel"] = "yarn g:devel";
            } else {
                scripts["devel"] = "yarn node --no-warnings devel.js";
            }
            return;
        default:
            if (config.build.bundler===BuildBundler.esbuild) {
                scripts["packd"] = "yarn g:esbuild";
            } else if (config.build.bundler===BuildBundler.rspack) {
                scripts["packd"] = "yarn g:rspack";
            } else {
                delete scripts["packd"];
            }
            return;
    }
}
