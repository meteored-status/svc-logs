/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 17 Jul 2026 10:54:44 GMT
 * Hash: 012fe343aab2d190fecc135ea3535059
 * Versión: 2026.7.17+2-josantoniojimnez
 * Anterior: 2026.7.17+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {lstat, readlink, symlink} from "node:fs/promises";
import {resolve} from "node:path";

import {unlink} from "../../../utiles/fs";
import {Colors} from "../colors";
import {Log} from "../log";

/**
 * Verifica que `{basedir}/.github` sea un symlink (Unix) o junction (Windows)
 * apuntando a `@mr/core/dev/.github`.
 * Si existe pero no apunta al destino correcto (directorio real, fichero u otro
 * enlace), lo elimina y crea el enlace correcto. Si no existe, lo crea.
 *
 * En Windows se usa una *junction* porque no requiere permisos de administrador
 * ni tener activado el Developer Mode, al contrario que los symlinks de directorio.
 * Las junctions requieren ruta absoluta como destino.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function initGithub(basedir: string): Promise<void> {
    const githubPath = `${basedir}/.github`;
    const destinoRelativo = "@mr/core/dev/.github";
    const isWindows = process.platform === "win32";

    // Las junctions de Windows requieren ruta absoluta como destino.
    // En Unix el symlink relativo es suficiente y más portable.
    const destinoEfectivo = isWindows
        ? resolve(basedir, destinoRelativo)
        : destinoRelativo;

    const stat = await lstat(githubPath).catch(() => undefined);

    if (stat !== undefined) {
        // readlink funciona tanto para symlinks Unix como para junctions Windows.
        // lstat().isSymbolicLink() devuelve false en Windows para junctions,
        // por eso se usa readlink como detector universal de enlace.
        const actual = await readlink(githubPath).catch(() => undefined);
        if (actual === destinoEfectivo) return; // ya está correcto

        // Es un directorio real, fichero o enlace incorrecto — eliminar
        Log.info({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgYellow], "Corrigiendo .github/ → symlink a @mr/core/dev/.github"));
        await unlink(githubPath);
    }

    // junction en Windows (no requiere permisos especiales)
    // symlink relativo estándar en Linux/macOS
    await symlink(destinoEfectivo, githubPath, isWindows ? "junction" : undefined);
}

/**
 * Verifica que `{basedir}/{nombre}` sea un symlink apuntando a
 * `@mr/core/dev/{nombre}`. Si existe pero no apunta al destino correcto
 * (fichero real u otro enlace), lo elimina y crea el enlace correcto.
 * Si no existe, lo crea.
 *
 * Usado por `initAgents`/`initClaude` — ambos son symlinks a fichero simple
 * (sin la casuística de junction de Windows que requiere `initGithub` para
 * enlazar un directorio).
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param nombre - Nombre del fichero en la raíz y en `@mr/core/dev/`.
 */
async function initSymlinkFichero(basedir: string, nombre: string): Promise<void> {
    const destinoPath = `${basedir}/${nombre}`;
    const destinoRelativo = `@mr/core/dev/${nombre}`;
    const isWindows = process.platform === "win32";

    // En Windows forzamos ruta absoluta para evitar variaciones de resolución.
    const destinoEfectivo = isWindows
        ? resolve(basedir, destinoRelativo)
        : destinoRelativo;

    const stat = await lstat(destinoPath).catch(() => undefined);

    if (stat !== undefined) {
        const actual = await readlink(destinoPath).catch(() => undefined);
        if (actual === destinoEfectivo) {
            return;
        }

        Log.info({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgYellow], `Corrigiendo ${nombre} -> symlink a @mr/core/dev/${nombre}`));
        await unlink(destinoPath);
    }

    await symlink(destinoEfectivo, destinoPath);
}

/**
 * Verifica que `{basedir}/AGENTS.md` sea un symlink apuntando a
 * `@mr/core/dev/AGENTS.md`.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function initAgents(basedir: string): Promise<void> {
    await initSymlinkFichero(basedir, "AGENTS.md");
}

/**
 * Verifica que `{basedir}/CLAUDE.md` sea un symlink apuntando a
 * `@mr/core/dev/CLAUDE.md`. Ese fichero canónico contiene los imports `@AGENTS.md` y
 * `@.github/copilot-instructions.md` para que Claude Code cargue las mismas instrucciones
 * que Copilot/Codex sin duplicar contenido (Claude no lee ninguno de los dos por sí solo).
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function initClaude(basedir: string): Promise<void> {
    await initSymlinkFichero(basedir, "CLAUDE.md");
}
