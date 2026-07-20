import fs from "node:fs/promises";
import path from "node:path";

import {createWorkspaceRule, isModuleLine, SKIP_DIRS} from "../rule-factory.mjs";

/**
 * Regexp para extraer el nombre corto del paquete @mr (primer segmento de path).
 * Ejemplo: "@mr/core-network/route" → captura "core-network".
 */
const MR_SEGMENT_RE = /@mr\/([\w-]+)/g;

// ─── Utilidades ────────────────────────────────────────────────────────────────

/**
 * Recorre recursivamente un directorio y acumula en `out` las rutas absolutas
 * de todos los ficheros .ts que no sean .d.ts.
 *
 * @param {string} dir
 * @param {string[]} out
 */
async function walkTs(dir, out) {
    const entries = await fs.readdir(dir, {withFileTypes: true}).catch(() => []);
    for (const entry of entries) {
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) {
                continue;
            }
            await walkTs(absolute, out);
        } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
            out.push(absolute);
        }
    }
}

/**
 * Lee todos los ficheros .ts de un workspace y devuelve el conjunto de
 * paquetes `@mr/<scope>` que se importan, excluyendo el propio paquete.
 *
 * @param {string} workspaceDir
 * @param {string} ownName - Nombre npm del workspace (para auto-excluirse).
 * @returns {Promise<Set<string>>}
 */
async function collectMrImports(workspaceDir, ownName) {
    const files = [];
    await walkTs(workspaceDir, files);

    const found = new Set();
    for (const file of files) {
        const content = await fs.readFile(file, "utf8").catch(() => "");
        for (const line of content.split("\n")) {
            if (!isModuleLine(line)) {
                continue;
            }
            MR_SEGMENT_RE.lastIndex = 0;
            let m;
            while ((m = MR_SEGMENT_RE.exec(line)) !== null) {
                const pkg = `@mr/${m[1]}`;
                if (pkg !== ownName) {
                    found.add(pkg);
                }
            }
        }
    }
    return found;
}

/**
 * Expande los patrones de workspaces del package.json raiz y devuelve las
 * rutas absolutas de cada directorio workspace.
 *
 * Soporta patrones simples (`dir` y `parent/*`); no requiere globbing completo
 * porque los patrones del monorepo son todos de esa forma.
 *
 * @param {string} rootDir
 * @returns {Promise<string[]>}
 */
async function findWorkspaceDirs(rootDir) {
    const rawPkg = await fs.readFile(path.join(rootDir, "package.json"), "utf8").catch(() => "{}");
    const rootPkg = JSON.parse(rawPkg);
    const patterns = rootPkg.workspaces ?? [];
    const dirs = [];

    for (const pattern of patterns) {
        if (pattern.endsWith("/*")) {
            const parent = path.join(rootDir, pattern.slice(0, -2));
            const entries = await fs.readdir(parent, {withFileTypes: true}).catch(() => []);
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    dirs.push(path.join(parent, entry.name));
                }
            }
        } else {
            dirs.push(path.join(rootDir, pattern));
        }
    }
    return dirs;
}

// ─── Regla ─────────────────────────────────────────────────────────────────────

/**
 * Regla WS001: sincroniza las devDependencies de cada workspace.
 *
 * Para cada workspace del monorepo:
 *  1. Escanea todos sus ficheros .ts en busca de imports `@mr/<scope>`.
 *  2. Compara los paquetes encontrados con `dependencies`, `devDependencies`,
 *     `peerDependencies` y `optionalDependencies` del package.json.
 *  3. Añade como `devDependencies` (con version `"workspace:*"`) cualquier
 *     paquete `@mr/*` que no estuviera declarado.
 *
 * Se ejecuta siempre que haya algun patch de fichero pendiente, por lo que
 * actua como guardia automatico de consistencia tras cualquier migracion.
 */
export const syncMrDevDepsRule = createWorkspaceRule({
    id: "WS001-sync-mr-devdeps",
    summary: "Sincroniza @mr/* en devDependencies segun imports .ts de cada workspace",
    async run(rootDir) {
        const workspaceDirs = await findWorkspaceDirs(rootDir);
        let changed = 0;

        for (const wsDir of workspaceDirs) {
            const pkgPath = path.join(wsDir, "package.json");
            const raw = await fs.readFile(pkgPath, "utf8").catch(() => null);
            if (raw === null) {
                continue;
            }

            let pkg;
            try {
                pkg = JSON.parse(raw);
            } catch {
                continue;
            }

            const ownName = typeof pkg.name === "string" ? pkg.name : "";
            const mrImports = await collectMrImports(wsDir, ownName);
            if (mrImports.size === 0) {
                continue;
            }

            // Union de todas las secciones de dependencias para detectar
            // si el paquete ya está declarado en cualquiera de ellas.
            const allDeclared = {
                ...(pkg.dependencies ?? {}),
                ...(pkg.devDependencies ?? {}),
                ...(pkg.peerDependencies ?? {}),
                ...(pkg.optionalDependencies ?? {}),
            };

            const missing = [...mrImports]
                .filter((dep) => !allDeclared[dep])
                .sort((a, b) => a.localeCompare(b));

            if (missing.length === 0) {
                continue;
            }

            const updatedDev = {...(pkg.devDependencies ?? {})};
            for (const dep of missing) {
                updatedDev[dep] = "workspace:*";
            }

            // Ordenar devDependencies alfabeticamente.
            pkg.devDependencies = Object.fromEntries(
                Object.entries(updatedDev).sort(([a], [b]) => a.localeCompare(b)),
            );

            await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
            changed += missing.length;
        }

        return {changed};
    },
});

