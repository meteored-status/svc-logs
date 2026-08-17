/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 05 Aug 2026 11:08:26 GMT
 * Hash: 1135c727d24f95d5adaff72c34553143
 * Versión: 2026.8.5+1-josantoniojimnez
 * Anterior: 2026.7.18+1-bixus
 * Proyecto: https://github.com/alpred/meteored-svc-estaticos
 */

import {link, lstat, readlink, rename, stat, symlink} from "node:fs/promises";
import {resolve} from "node:path";

import {isDir, isFile, readDir, unlink} from "../../../utiles/fs";
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
 * Usado por `initAgents`/`initClaude` — ambos son enlaces a fichero simple
 * (sin la casuística de junction de Windows que requiere `initGithub`/`initClaudeDir` para
 * enlazar un directorio).
 *
 * En Windows los symlinks de fichero requieren permisos de administrador o tener
 * activado el Developer Mode (`SeCreateSymbolicLinkPrivilege`), a diferencia de las
 * junctions de directorio. Por eso ahí se usa en su lugar un *hardlink* (`fs.link`),
 * que en NTFS no requiere ningún privilegio especial. La detección de "ya está
 * correcto" se hace comparando el inodo (`ino`)/dispositivo (`dev`) en vez de
 * `readlink`, ya que un hardlink es indistinguible de un fichero normal.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param nombre - Nombre del fichero en la raíz y en `@mr/core/dev/`.
 */
async function initSymlinkFichero(basedir: string, nombre: string): Promise<void> {
    const destinoPath = `${basedir}/${nombre}`;
    const destinoRelativo = `@mr/core/dev/${nombre}`;
    const isWindows = process.platform === "win32";

    if (isWindows) {
        const origenPath = resolve(basedir, destinoRelativo);
        const destinoStat = await lstat(destinoPath).catch(() => undefined);

        if (destinoStat !== undefined) {
            const origenStat = await stat(origenPath).catch(() => undefined);
            if (origenStat !== undefined && destinoStat.dev === origenStat.dev && destinoStat.ino === origenStat.ino) {
                return; // ya es el mismo hardlink
            }

            Log.info({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgYellow], `Corrigiendo ${nombre} -> hardlink a @mr/core/dev/${nombre}`));
            await unlink(destinoPath);
        }

        await link(origenPath, destinoPath);
        return;
    }

    const stats = await lstat(destinoPath).catch(() => undefined);

    if (stats !== undefined) {
        const actual = await readlink(destinoPath).catch(() => undefined);
        if (actual === destinoRelativo) {
            return;
        }

        Log.info({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgYellow], `Corrigiendo ${nombre} -> symlink a @mr/core/dev/${nombre}`));
        await unlink(destinoPath);
    }

    await symlink(destinoRelativo, destinoPath);
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

/**
 * Verifica que `{basedir}/CONTRIBUTING.md` sea un symlink apuntando a
 * `@mr/core/dev/CONTRIBUTING.md`. Ese fichero canónico documenta las convenciones de
 * ramas, versionado y despliegue (git-flow del monorepo, Cloud Build) — enlazado desde
 * `CLAUDE.md` (import `@CONTRIBUTING.md`) y desde `.github/copilot-instructions.md`,
 * ambos resueltos desde la raíz del repo.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function initContributing(basedir: string): Promise<void> {
    await initSymlinkFichero(basedir, "CONTRIBUTING.md");
}

/**
 * Migra a `destinoDir` cualquier entrada de `origenDir` que no exista ya en `destinoDir`.
 * Usado antes de sustituir un directorio real por un symlink, para no perder ficheros
 * locales (ej. `.claude/settings.local.json`) que un desarrollador ya tuviera ahí.
 *
 * @param origenDir - Directorio real que va a eliminarse (ej. `{basedir}/.claude`).
 * @param destinoDir - Directorio canónico de destino (ej. `{basedir}/@mr/core/dev/.claude`).
 */
async function migrarArchivosLocales(origenDir: string, destinoDir: string): Promise<void> {
    const entradas = await readDir(origenDir).catch(() => [] as string[]);
    for (const entrada of entradas) {
        const origen = `${origenDir}/${entrada}`;
        const destino = `${destinoDir}/${entrada}`;
        if (await isFile(destino) || await isDir(destino)) {
            continue; // ya existe en el framework; no sobreescribir
        }
        await rename(origen, destino).catch(() => undefined);
    }
}

/**
 * Verifica que `{basedir}/.claude` sea un symlink (Unix) o junction (Windows) apuntando a
 * `@mr/core/dev/.claude`, igual que `initGithub` con `.github`. Ese directorio canónico
 * declara el hook `Stop` que hace cumplir el mantenimiento de CODEMAP.md/CHANGELOG.md
 * (`.claude/settings.json` + `.claude/hooks/check-codemap.mjs`), propagado así a cualquier
 * monorepo que sincronice este framework, sin tocar nada manualmente en él.
 *
 * Si `{basedir}/.claude` ya existe como directorio real (ej. con un `settings.local.json`
 * local creado antes de tener este framework), sus entradas se migran primero a
 * `@mr/core/dev/.claude` (sin sobreescribir lo que ya hubiera) para no perderlas — quedan
 * excluidas del envío del framework vía `@mr/core/dev/.claude/.mr-ignore`.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function initClaudeDir(basedir: string): Promise<void> {
    const claudePath = `${basedir}/.claude`;
    const destinoRelativo = "@mr/core/dev/.claude";
    const isWindows = process.platform === "win32";

    const destinoEfectivo = isWindows
        ? resolve(basedir, destinoRelativo)
        : destinoRelativo;

    const stat = await lstat(claudePath).catch(() => undefined);

    if (stat !== undefined) {
        const actual = await readlink(claudePath).catch(() => undefined);
        if (actual === destinoEfectivo) {
            return; // ya está correcto
        }

        if (await isDir(claudePath)) {
            // Directorio real (no symlink todavía): preservar ficheros locales antes de sustituir.
            await migrarArchivosLocales(claudePath, `${basedir}/${destinoRelativo}`);
        }

        Log.info({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgYellow], "Corrigiendo .claude/ → symlink a @mr/core/dev/.claude"));
        await unlink(claudePath);
    }

    await symlink(destinoEfectivo, claudePath, isWindows ? "junction" : undefined);
}
