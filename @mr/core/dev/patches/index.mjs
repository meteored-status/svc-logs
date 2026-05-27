#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

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
    breakingForwardIncommingConnectionRenameRule, // R014 (breaking: forwardIncommingConnection -> forwardIncomingConnection)
    deprecatedNetRequestParserJsonImportRule,     // R015 (services-comun/modules/net/request/parser/json)
];
const TARGET_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set([
    ".git",
    ".idea",
    ".vscode",
    ".yarn",
    "deprecated",
    "node_modules",
    "output",
    "dist",
    "build",
    "coverage",
    "tmp",
]);

function parseArgs(argv) {
    const set = new Set(argv.slice(2));
    return {
        write: set.has("--write"),
        check: set.has("--check"),
        verbose: set.has("--verbose"),
    };
}

async function walk(dir, out) {
    const entries = await fs.readdir(dir, {withFileTypes: true});
    for (const entry of entries) {
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) {
                continue;
            }
            await walk(absolute, out);
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

async function processFile(filePath, write) {
    const original = await fs.readFile(filePath, "utf8");
    let content = original;
    const hits = [];

    for (const rule of RULES) {
        const result = rule.apply(content, filePath);
        if (result.replacements > 0) {
            hits.push({ruleId: rule.id, count: result.replacements});
            content = result.content;
        }
    }

    if (hits.length === 0) {
        return {changed: false, hits: []};
    }

    if (write && content !== original) {
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
    const modeWrite = args.write && !args.check;

    const spinner = new Spinner();

    spinner.start("mrpack-patch: escaneando archivos...");
    const files = [];
    await walk(ROOT, files);
    spinner.update(`mrpack-patch: analizando ${files.length} archivos...`);

    let changedFiles = 0;
    const totalsByRule = new Map();

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        spinner.update(`mrpack-patch: [${i + 1}/${files.length}] ${path.relative(ROOT, file)}`);
        const result = await processFile(file, modeWrite);
        if (!result.changed) {
            continue;
        }

        changedFiles += 1;
        const rel = path.relative(ROOT, file);
        if (args.verbose || !modeWrite) {
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

    if (changedFiles === 0) {
        console.log("mrpack-patch: sin cambios");
        return;
    }

    const totals = [...totalsByRule.entries()]
        .map(([ruleId, count]) => `${ruleId}=${count}`)
        .join(", ");

    if (modeWrite) {
        console.log(`mrpack-patch: actualizados ${changedFiles} archivo(s) (${totals})`);
        return;
    }

    console.error(`mrpack-patch: hay ${changedFiles} archivo(s) pendientes (${totals})`);
    process.exitCode = 1;
}

main().catch((err) => {
    console.error("mrpack-patch: fallo", err);
    process.exitCode = 1;
});
