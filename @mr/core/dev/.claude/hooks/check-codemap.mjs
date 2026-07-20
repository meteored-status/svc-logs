#!/usr/bin/env node
/**
 * Hook `Stop` de Claude Code: comprueba que los cambios "significativos" en el working tree
 * (nuevos módulos, o >= LINEAS_UMBRAL líneas modificadas) vengan acompañados de una
 * actualización de CODEMAP.md (y de CHANGELOG.md, si ya existía) en el workspace afectado.
 *
 * Alcance y limitaciones (ver @mr/core/dev/README.md y AGENTS.md para más contexto):
 * - Solo analiza cambios en working tree (no comiteados).
 * - Heurística por líneas/ficheros nuevos, no análisis semántico: puede haber falsos
 *   positivos/negativos. Ajustar LINEAS_UMBRAL si resulta demasiado ruidoso o laxo.
 * - Por el guardrail estándar de Claude Code (`stop_hook_active`), este hook solo bloquea
 *   una vez por intento de parada — evita bucles infinitos, no se debe intentar sortear.
 * - Se invoca siempre como `node check-codemap.mjs` (nunca ejecutado directamente), así que
 *   el bit ejecutable del fichero es irrelevante para su funcionamiento.
 */

import {execFileSync} from "node:child_process";
import {existsSync, readFileSync, readdirSync} from "node:fs";
import path from "node:path";

const LINEAS_UMBRAL = 15;
const EXTENSIONES_CODIGO = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const PREFIJOS_IGNORADOS = ["node_modules/", ".yarn/", "output/", "files/", "bin/min/", "tmp/", ".git/"];
const DIRS_IGNORADOS_BUSQUEDA = new Set(["node_modules", ".yarn", "output", "files", "bin", "tmp", ".git"]);

function leerEntrada() {
    try {
        return JSON.parse(readFileSync(0, "utf-8"));
    } catch (e) {
        return {};
    }
}

function git(args, cwd) {
    try {
        return execFileSync("git", args, {cwd, encoding: "utf-8"});
    } catch (e) {
        return "";
    }
}

function normalizarRuta(ruta) {
    if (ruta.startsWith("\"") && ruta.endsWith("\"")) {
        try {
            return JSON.parse(ruta);
        } catch (e) {
            return ruta;
        }
    }
    return ruta;
}

function parsearStatus(salida) {
    const cambios = [];
    for (const linea of salida.split("\n")) {
        if (linea.length < 4) {
            continue;
        }
        const codigo = linea.slice(0, 2);
        if (codigo[0] === "D" || codigo[1] === "D") {
            continue;
        }
        let ruta = linea.slice(3);
        const flechaIdx = ruta.indexOf(" -> ");
        if (flechaIdx !== -1) {
            ruta = ruta.slice(flechaIdx + 4);
        }
        ruta = normalizarRuta(ruta);
        cambios.push({ruta, nuevo: codigo.includes("?") || codigo[0] === "A"});
    }
    return cambios;
}

function rutaIgnorada(ruta) {
    return PREFIJOS_IGNORADOS.some((prefijo) => ruta.startsWith(prefijo) || ruta.includes(`/${prefijo}`));
}

function raizWorkspace(basedir, ruta) {
    let dir = path.dirname(path.join(basedir, ruta));
    while (dir !== basedir && dir !== path.dirname(dir)) {
        if (existsSync(path.join(dir, "package.json"))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return null;
}

function aPosix(rutaAbs, basedir) {
    return path.relative(basedir, rutaAbs).split(path.sep).join("/");
}

/**
 * Busca si algún fichero de nombre `nombreArchivo` fue tocado dentro del árbol de
 * `workspaceRel` (a cualquier profundidad) — los CODEMAP.md/CHANGELOG.md de este monorepo
 * viven anidados por submódulo (ej. `@mr/cli/src/mrpack/CODEMAP.md`), no en la raíz exacta
 * del workspace.
 */
function tocadoEnArbol(rutasCambiadas, workspaceRel, nombreArchivo) {
    for (const ruta of rutasCambiadas) {
        if (ruta === `${workspaceRel}/${nombreArchivo}` || (ruta.startsWith(`${workspaceRel}/`) && ruta.endsWith(`/${nombreArchivo}`))) {
            return true;
        }
    }
    return false;
}

/**
 * Comprueba (recursivamente, con límite de profundidad) si existe algún fichero
 * `nombreArchivo` en el árbol de `dirRaiz`, saltando directorios de artefactos/dependencias.
 */
function existeEnArbol(dirRaiz, nombreArchivo, profundidadMax = 6) {
    const pila = [{dir: dirRaiz, profundidad: 0}];
    while (pila.length > 0) {
        const {dir, profundidad} = pila.pop();
        let entradas;
        try {
            entradas = readdirSync(dir, {withFileTypes: true});
        } catch (e) {
            continue;
        }
        for (const entrada of entradas) {
            if (entrada.isDirectory()) {
                if (DIRS_IGNORADOS_BUSQUEDA.has(entrada.name) || profundidad >= profundidadMax) {
                    continue;
                }
                pila.push({dir: path.join(dir, entrada.name), profundidad: profundidad + 1});
            } else if (entrada.name === nombreArchivo) {
                return true;
            }
        }
    }
    return false;
}

/**
 * `git status --porcelain` colapsa un directorio nuevo entero en una sola línea
 * (`?? services/logs/src/`) en vez de listar cada fichero — así que un módulo nuevo pasaría
 * desapercibido. Para cada entrada de directorio nuevo detectada se expande con una llamada
 * de `git status` **acotada a ese pathspec** (`--untracked-files=all -- <ruta>`), no al repo
 * completo, evitando el coste de memoria de correr `-uall` sobre todo el monorepo.
 */
function expandirDirectorioNuevo(basedir, rutaDir) {
    const salida = git(["status", "--porcelain=v1", "--untracked-files=all", "--", rutaDir], basedir);
    return parsearStatus(salida);
}

function bloquear(reason) {
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: "Stop",
            decision: "block",
            reason,
        },
    }));
}

function main() {
    const entrada = leerEntrada();
    if (entrada.stop_hook_active === true) {
        return;
    }

    const basedir = entrada.cwd || process.cwd();
    const statusSalida = git(["status", "--porcelain=v1"], basedir);
    if (!statusSalida.trim()) {
        return;
    }

    const sinExpandir = parsearStatus(statusSalida).filter(({ruta}) => !rutaIgnorada(ruta));
    const cambios = [];
    for (const cambio of sinExpandir) {
        if (cambio.ruta.endsWith("/")) {
            cambios.push(...expandirDirectorioNuevo(basedir, cambio.ruta).filter(({ruta}) => !rutaIgnorada(ruta)));
        } else {
            cambios.push(cambio);
        }
    }
    if (cambios.length === 0) {
        return;
    }

    const rutasCambiadas = new Set(cambios.map(({ruta}) => ruta));
    const grupos = new Map();

    for (const {ruta, nuevo} of cambios) {
        if (!EXTENSIONES_CODIGO.has(path.extname(ruta))) {
            continue;
        }
        const workspaceAbs = raizWorkspace(basedir, ruta);
        if (workspaceAbs === null) {
            continue;
        }
        if (!grupos.has(workspaceAbs)) {
            grupos.set(workspaceAbs, {archivos: [], nuevo: false});
        }
        const grupo = grupos.get(workspaceAbs);
        grupo.archivos.push(ruta);
        if (nuevo) {
            grupo.nuevo = true;
        }
    }

    const missingCodemap = [];
    const missingChangelog = [];

    for (const [workspaceAbs, grupo] of grupos) {
        let significativo = grupo.nuevo;
        if (!significativo) {
            const numstat = git(["diff", "--numstat", "--", ...grupo.archivos], basedir);
            let total = 0;
            for (const linea of numstat.split("\n")) {
                const partes = linea.trim().split(/\s+/);
                if (partes.length >= 2) {
                    total += (parseInt(partes[0], 10) || 0) + (parseInt(partes[1], 10) || 0);
                }
            }
            significativo = total >= LINEAS_UMBRAL;
        }
        if (!significativo) {
            continue;
        }

        const workspaceRel = aPosix(workspaceAbs, basedir);
        if (!tocadoEnArbol(rutasCambiadas, workspaceRel, "CODEMAP.md")) {
            missingCodemap.push(workspaceRel);
        }

        if (existeEnArbol(workspaceAbs, "CHANGELOG.md") && !tocadoEnArbol(rutasCambiadas, workspaceRel, "CHANGELOG.md")) {
            missingChangelog.push(workspaceRel);
        }
    }

    if (missingCodemap.length === 0 && missingChangelog.length === 0) {
        return;
    }

    const partesRazon = [];
    if (missingCodemap.length > 0) {
        partesRazon.push(`Actualiza (o crea, enlazándolo desde el README.md más cercano) CODEMAP.md en: ${missingCodemap.join(", ")}.`);
    }
    if (missingChangelog.length > 0) {
        partesRazon.push(`Actualiza CHANGELOG.md en: ${missingChangelog.join(", ")}.`);
    }
    partesRazon.push("Si el cambio no es significativo o ya está documentado en otro sitio, ignora este aviso y continúa.");

    bloquear(partesRazon.join(" "));
}

try {
    main();
} catch (e) {
    // Fail-open: un error en esta heurística no debe bloquear al agente.
}
