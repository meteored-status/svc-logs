#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {SKIP_DIRS} from "./rule-factory.mjs";
import {deprecatedConexionImportRule} from "./rules/deprecated-conexion-import.mjs";
import {deprecatedRouteGroupImportRule} from "./rules/deprecated-routes-group-import.mjs";
import {deprecatedRouteGroupBlockImportRule} from "./rules/deprecated-routes-group-block-import.mjs";
import {deprecatedConfigConfigImportRule} from "./rules/deprecated-config-config-import.mjs";
import {deprecatedConfigDominioImportRule} from "./rules/deprecated-config-dominio-import.mjs";
import {deprecatedI18nNetImportRule} from "./rules/deprecated-i18n-net-import.mjs";
import {deprecatedI18nIndexImportRule} from "./rules/deprecated-i18n-index-import.mjs";
import {deprecatedNetInterfaceImportRule} from "./rules/deprecated-net-interface-import.mjs";
import {deprecatedNetDeviceImportRule} from "./rules/deprecated-net-device-import.mjs";
import {deprecatedNetUtilesImportRule} from "./rules/deprecated-net-utiles-import.mjs";
import {deprecatedNetServiceImportRule} from "./rules/deprecated-net-service-import.mjs";
import {deprecatedNetServerImportRule} from "./rules/deprecated-net-server-import.mjs";
import {deprecatedNetCheckersImportRule} from "./rules/deprecated-net-checkers-import.mjs";
import {breakingForwardIncommingConnectionRenameRule} from "./rules/breaking-forward-incomming-connection-rename.mjs";
import {deprecatedNetRequestParserJsonImportRule} from "./rules/deprecated-net-request-parser-json-import.mjs";
import {deprecatedFrontendDeviceImportRule} from "./rules/deprecated-frontend-device-import.mjs";
import {deprecatedPortalSeccionImportRule} from "./rules/deprecated-portal-seccion-import.mjs";
import {deprecatedPortalConfigImportRule} from "./rules/deprecated-portal-config-import.mjs";
import {deprecatedPortalMeteoredImportRule} from "./rules/deprecated-portal-meteored-import.mjs";
import {deprecatedPortalIdiomasImportRule} from "./rules/deprecated-portal-idiomas-import.mjs";
import {deprecatedServicesClusterImportRule} from "./rules/deprecated-services-cluster-import.mjs";
import {deprecatedServicesMainImportRule} from "./rules/deprecated-services-main-import.mjs";
import {deprecatedEngineBaseImportRule} from "./rules/deprecated-engine-base-import.mjs";
import {deprecatedEngineServerImportRule} from "./rules/deprecated-engine-server-import.mjs";
import {deprecatedWorkloadNetConfigImportRule} from "./rules/deprecated-workload-net-config-import.mjs";
import {deprecatedMeteoredUtilesConfigImportRule} from "./rules/deprecated-meteored-utiles-config-import.mjs";
import {deprecatedUtilesPodImportRule} from "./rules/deprecated-utiles-pod-import.mjs";
import {deprecatedPortalTiempoDominiosImportRule} from "./rules/deprecated-portal-tiempo-dominios-import.mjs";
import {deprecatedPortalTiempoLoaderImportRule} from "./rules/deprecated-portal-tiempo-loader-import.mjs";
import {deprecatedPortalTiempoImportRule} from "./rules/deprecated-portal-tiempo-import.mjs";
import {breakingDominioTiempoRenameRule} from "./rules/breaking-dominio-tiempo-rename.mjs";
import {breakingDominioTiempoListRenameRule} from "./rules/breaking-dominio-tiempo-list-rename.mjs";
import {breakingUserTiempoDomainDefaultImportRule} from "./rules/breaking-user-tiempo-domain-default-import.mjs";
import {syncMrDevDepsRule} from "./rules/sync-mr-devdeps.mjs";

// La raiz del monorepo se infiere a partir de la ubicacion de este script:
// <raiz>/@mr/core/dev/patches/index.mjs -> subir 4 niveles.
// Esto es independiente del cwd y de como se invoque (node directo, yarn workspace, etc.)
const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const RULES = [
    // Orden importante: subpaths antes que paths padre para evitar matches parciales.
    deprecatedRouteGroupBlockImportRule,    // R003 (services-comun/modules/net/routes/group/block)
    deprecatedRouteGroupImportRule,         // R002 (services-comun/modules/net/routes/group)
    deprecatedI18nNetImportRule,            // R006 (services-comun/modules/net/i18n/net)
    deprecatedI18nIndexImportRule,          // R007 (services-comun/modules/net/i18n)
    deprecatedConfigConfigImportRule,       // R004 (services-comun/modules/net/config/config)
    deprecatedConfigDominioImportRule,      // R005 (services-comun/modules/net/config/dominio)
    deprecatedConexionImportRule,           // R001 (services-comun/modules/net/conexion)
    deprecatedNetInterfaceImportRule,       // R008 (services-comun/modules/net/interface)
    deprecatedNetDeviceImportRule,          // R009 (services-comun/modules/net/device)
    deprecatedNetUtilesImportRule,          // R010 (services-comun/modules/net/utiles)
    deprecatedNetServiceImportRule,         // R011 (services-comun/modules/net/service)
    deprecatedNetServerImportRule,          // R012 (services-comun/modules/net/server)
    deprecatedNetCheckersImportRule,        // R013 (services-comun/modules/net/checkers)
    breakingForwardIncommingConnectionRenameRule,  // R014 (breaking: forwardIncommingConnection -> forwardIncomingConnection)
    deprecatedNetRequestParserJsonImportRule,      // R015 (services-comun/modules/net/request/parser/json)
    deprecatedFrontendDeviceImportRule,            // R016 (services-comun/modules/frontend/device)
    deprecatedPortalSeccionImportRule,             // R017 (services-comun-meteored/modules/portal/meteored/seccion/*)
    deprecatedPortalConfigImportRule,              // R019 (services-comun-meteored/modules/portal/meteored/config/*)
    deprecatedPortalIdiomasImportRule,             // R020 (services-comun-meteored/modules/portal/idiomas)
    deprecatedPortalMeteoredImportRule,            // R018 (services-comun-meteored/modules/portal/meteored/*)
    deprecatedServicesClusterImportRule,           // R021 (services-comun/cluster)
    deprecatedServicesMainImportRule,              // R022 (services-comun/main)
    deprecatedEngineBaseImportRule,                // R023 ({EngineBase} from services-comun/modules/engine_base)
    deprecatedEngineServerImportRule,              // R024 ({EngineServer} from services-comun/modules/engine_server)
    deprecatedWorkloadNetConfigImportRule,         // R025 ({ConfiguracionNet, IConfiguracionNet} from @mr/core-network/server/http/config/config)
    deprecatedMeteoredUtilesConfigImportRule,      // R026 (services-comun/modules/utiles/config -> @mr/core-utils/config + @mr/core-workload/config/*)
    deprecatedUtilesPodImportRule,                 // R027 (services-comun/modules/utiles/pod -> @mr/core-workload/config/pod)
    deprecatedPortalTiempoDominiosImportRule,      // R028 (services-comun-meteored/modules/portal/tiempo/dominios/* -> @mr/user-tiempo-domain/sites/*)
    deprecatedPortalTiempoLoaderImportRule,        // R029 (services-comun-meteored/modules/portal/tiempo/loader -> @mr/user-tiempo-domain/loader)
    deprecatedPortalTiempoImportRule,              // R030 (services-comun-meteored/modules/portal/tiempo -> @mr/user-tiempo-domain; preserva TPlataforma)
    breakingDominioTiempoRenameRule,               // R031 (breaking: DominioTiempo -> Dominio as DominioTiempo en @mr/user-tiempo-domain)
    breakingUserTiempoDomainDefaultImportRule,     // R032 (breaking: import Foo from @mr/user-tiempo-domain -> import {Dominio as Foo} from @mr/user-tiempo-domain)
    breakingDominioTiempoListRenameRule,           // R033 (breaking: DominioTiempoList -> DominioList as DominioTiempoList en @mr/user-tiempo-domain/loader)
];
/**
 * Reglas de nivel workspace. Se ejecutan siempre que haya al menos un patch
 * de fichero pendiente. No usan el cursor: son idempotentes por diseno.
 */
const WORKSPACE_RULES = [
    syncMrDevDepsRule,  // WS001 - sincroniza @mr/* en devDependencies
];
const TARGET_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const CONFIG_WORKSPACES_FILE = path.join(ROOT, "config.workspaces.json");

function parseArgs(argv) {
    const set = new Set(argv.slice(2));
    return {
        verbose: set.has("--verbose"),
    };
}

function getPatchCode(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const match = value.trim().toUpperCase().match(/^R\d+/);
    return match?.[0];
}

function getPatchNumber(value) {
    const patch = getPatchCode(value);
    if (patch === undefined) {
        return undefined;
    }
    return Number.parseInt(patch.slice(1), 10);
}

function getRulesSince(lastPatch) {
    if (lastPatch === undefined) {
        return RULES;
    }

    const patch = getPatchCode(lastPatch);
    if (patch === undefined) {
        return RULES;
    }

    const index = RULES.findIndex((rule) => getPatchCode(rule.id) === patch);
    if (index >= 0) {
        return RULES.slice(index + 1);
    }

    const currentPatch = getPatchNumber(patch);
    if (currentPatch === undefined) {
        return RULES;
    }

    return RULES.filter((rule) => {
        const rulePatch = getPatchNumber(rule.id);
        return rulePatch !== undefined && rulePatch > currentPatch;
    });
}

async function readPatchCursor() {
    const raw = await fs.readFile(CONFIG_WORKSPACES_FILE, "utf8").catch(() => undefined);
    if (raw === undefined) {
        return undefined;
    }
    const json = JSON.parse(raw);
    return getPatchCode(json?.patch);
}

async function writePatchCursor(patch) {
    const raw = await fs.readFile(CONFIG_WORKSPACES_FILE, "utf8").catch(() => undefined);
    if (raw === undefined) {
        return;
    }

    const json = JSON.parse(raw);
    if (getPatchCode(json?.patch) === patch) {
        return;
    }

    json.patch = patch;
    await fs.writeFile(CONFIG_WORKSPACES_FILE, `${JSON.stringify(json, null, 2)}\n`, "utf8");
}

async function walk(dir, out, {skipRootI18n = false} = {}) {
    const entries = await fs.readdir(dir, {withFileTypes: true});
    for (const entry of entries) {
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (skipRootI18n && dir === ROOT && entry.name === "i18n") {
                continue;
            }
            if (SKIP_DIRS.has(entry.name)) {
                continue;
            }
            await walk(absolute, out, {skipRootI18n});
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        if (!TARGET_EXT.has(path.extname(entry.name))) {
            continue;
        }
        out.push(absolute);
    }
}

async function processFile(filePath, rules) {
    const original = await fs.readFile(filePath, "utf8");
    let content = original;
    const hits = [];

    for (const rule of rules) {
        const result = rule.apply(content, filePath);
        if (result.replacements > 0) {
            hits.push({ruleId: rule.id, count: result.replacements});
            content = result.content;
        }
    }

    if (hits.length === 0) {
        return {changed: false, hits: []};
    }

    if (content !== original) {
        await fs.writeFile(filePath, content, "utf8");
    }

    return {changed: content !== original, hits};
}

/**
 * Spinner minimo que escribe en stderr para no contaminar stdout.
 * Solo activo cuando stderr es un TTY (no en CI ni pipes).
 */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
class Spinner {
    constructor() {
        this._frame = 0;
        this._timer = null;
        this._active = false;
        this._msg = "";
        this._tty = process.stderr.isTTY === true;
    }

    start(msg) {
        this._msg = msg;
        if (!this._tty) {
            process.stderr.write(`${msg}\n`);
            return;
        }
        this._active = true;
        this._timer = setInterval(() => this._tick(), 80);
        this._timer.unref();
        this._tick();
    }

    update(msg) {
        this._msg = msg;
        if (!this._tty) {
            return;
        }
    }

    stop() {
        if (!this._tty) {
            return;
        }
        if (this._timer !== null) {
            clearInterval(this._timer);
            this._timer = null;
        }
        // Borra la linea del spinner.
        process.stderr.write("\r\x1b[K");
        this._active = false;
    }

    _tick() {
        const frame = SPINNER_FRAMES[this._frame % SPINNER_FRAMES.length];
        this._frame += 1;
        // \r vuelve al inicio de linea; \x1b[K borra hasta el final.
        const line = `\r\x1b[K${frame} ${this._msg}`;
        const maxWidth = (process.stderr.columns ?? 80) - 2;
        process.stderr.write(line.slice(0, maxWidth));
    }
}

async function main() {
    const args = parseArgs(process.argv);
    const lastPatch = await readPatchCursor();
    const activeRules = getRulesSince(lastPatch);

    if (activeRules.length === 0) {
        const patch = lastPatch ?? getPatchCode(RULES.at(-1)?.id);
        const suffix = patch !== undefined ? ` (ultimo: ${patch})` : "";
        console.log(`mrpack-patch: no hay patches nuevos${suffix}`);
        return;
    }

    const spinner = new Spinner();

    const patchInfo = lastPatch !== undefined ? ` desde ${lastPatch}` : "";
    spinner.start(`mrpack-patch: escaneando archivos${patchInfo}...`);
    const files = [];
    await walk(ROOT, files, {skipRootI18n: true});
    spinner.update(`mrpack-patch: analizando ${files.length} archivos...`);

    let changedFiles = 0;
    const totalsByRule = new Map();

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        spinner.update(`mrpack-patch: [${i + 1}/${files.length}] ${path.relative(ROOT, file)}`);
        const result = await processFile(file, activeRules);
        if (!result.changed) {
            continue;
        }

        changedFiles += 1;
        const rel = path.relative(ROOT, file);
        if (args.verbose) {
            spinner.stop();
            const summary = result.hits.map(hit => `${hit.ruleId} x${hit.count}`).join(", ");
            console.log(`${rel}: ${summary}`);
            spinner.start(`mrpack-patch: [${i + 1}/${files.length}] ${path.relative(ROOT, file)}`);
        }

        for (const hit of result.hits) {
            totalsByRule.set(hit.ruleId, (totalsByRule.get(hit.ruleId) ?? 0) + hit.count);
        }
    }

    spinner.stop();

    // ── Reglas de workspace ────────────────────────────────────────────────────
    // Se ejecutan siempre que haya patches pendientes (activeRules.length > 0).
    // Son idempotentes: no usan cursor, solo sincronizan lo que falte.
    spinner.start("mrpack-patch: ejecutando reglas de workspace...");
    const totalsByWorkspaceRule = new Map();
    for (const wsRule of WORKSPACE_RULES) {
        const result = await wsRule.run(ROOT);
        if (result.changed > 0) {
            totalsByWorkspaceRule.set(wsRule.id, result.changed);
            if (args.verbose) {
                spinner.stop();
                console.log(`${wsRule.id}: ${result.changed} entrada(s) añadida(s) en package.json`);
                spinner.start("mrpack-patch: ejecutando reglas de workspace...");
            }
        }
    }
    spinner.stop();
    // ──────────────────────────────────────────────────────────────────────────

    if (changedFiles === 0 && totalsByWorkspaceRule.size === 0) {
        const latestPatch = getPatchCode(activeRules.at(-1)?.id);
        if (latestPatch !== undefined) {
            await writePatchCursor(latestPatch);
        }
        console.log("mrpack-patch: sin cambios");
        return;
    }

    const latestPatch = getPatchCode(activeRules.at(-1)?.id);
    if (latestPatch !== undefined) {
        await writePatchCursor(latestPatch);
    }

    const parts = [];
    if (changedFiles > 0) {
        const totals = [...totalsByRule.entries()]
            .map(([ruleId, count]) => `${ruleId}=${count}`)
            .join(", ");
        parts.push(`${changedFiles} archivo(s) (${totals})`);
    }
    if (totalsByWorkspaceRule.size > 0) {
        const wsTotals = [...totalsByWorkspaceRule.entries()]
            .map(([ruleId, count]) => `${ruleId}=${count}`)
            .join(", ");
        parts.push(`workspace (${wsTotals})`);
    }
    console.log(`mrpack-patch: actualizados ${parts.join(" + ")}`);
}

main().catch((err) => {
    console.error("mrpack-patch: fallo", err);
    process.exitCode = 1;
});
