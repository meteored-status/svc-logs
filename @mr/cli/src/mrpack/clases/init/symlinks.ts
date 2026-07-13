import {lstat, readlink, symlink} from "node:fs/promises";
import {resolve} from "node:path";

import {unlink} from "services-comun/modules/utiles/fs";

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
 * Verifica que `{basedir}/AGENTS.md` sea un symlink apuntando a
 * `@mr/core/dev/AGENTS.md`.
 *
 * Si existe pero no apunta al destino correcto (fichero real u otro enlace),
 * lo elimina y crea el enlace correcto. Si no existe, lo crea.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function initAgents(basedir: string): Promise<void> {
    const agentsPath = `${basedir}/AGENTS.md`;
    const destinoRelativo = "@mr/core/dev/AGENTS.md";
    const isWindows = process.platform === "win32";

    // En Windows forzamos ruta absoluta para evitar variaciones de resolución.
    const destinoEfectivo = isWindows
        ? resolve(basedir, destinoRelativo)
        : destinoRelativo;

    const stat = await lstat(agentsPath).catch(() => undefined);

    if (stat !== undefined) {
        const actual = await readlink(agentsPath).catch(() => undefined);
        if (actual === destinoEfectivo) {
            return;
        }

        Log.info({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgYellow], "Corrigiendo AGENTS.md -> symlink a @mr/core/dev/AGENTS.md"));
        await unlink(agentsPath);
    }

    await symlink(destinoEfectivo, agentsPath);
}
