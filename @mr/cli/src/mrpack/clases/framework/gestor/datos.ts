/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 0c6a36eb0fdaf6d514eb0131fd793d50
 * Versión: 2026.7.14+1-josantoniojimnez
 * Anterior: 2026.6.25+7-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {Storage} from "@google-cloud/storage";

import {isDir, isFile, readDir} from "../../../../utiles/fs";
import {Paquete, PaqueteTipo} from "../../paquete";

/**
 * Acción a ejecutar sobre un paquete en el gestor de frameworks.
 *
 * - `Nada`           — no hacer nada.
 * - `Instalar`       — descargar e instalar un paquete que no está presente localmente.
 * - `Actualizar`     — aplicar la versión remota más reciente a un paquete ya instalado.
 * - `Resetear`       — descartar cambios locales y restaurar el último estado publicado.
 * - `Desinstalar`    — eliminar el directorio local del paquete.
 * - `Enviar`         — publicar los cambios locales en GCS (sin update previo).
 * - `EnviarConUpdate`— aplicar el update remoto y, si no hay conflictos, publicar los cambios locales.
 */
export const enum Accion {
    Nada            = "nada",
    Instalar        = "instalar",
    Actualizar      = "actualizar",
    Resetear        = "resetear",
    Desinstalar     = "desinstalar",
    Enviar          = "enviar",
    EnviarConUpdate = "enviarConUpdate",
}

/**
 * Estado completo de un paquete para el gestor interactivo.
 *
 * @property tipo                - Categoría del paquete.
 * @property nombre              - Nombre corto sin tipo.
 * @property npmName             - Nombre npm completo.
 * @property localDir            - Ruta absoluta del directorio local del paquete.
 * @property paquete             - Instancia de `Paquete` (real o virtual).
 * @property instalado           - `true` si el paquete está descargado localmente.
 * @property tieneUpdate         - `true` si hay una versión remota más reciente disponible.
 * @property versionLocal        - Versión instalada, o `undefined` si no está instalado.
 * @property versionLatest       - Versión remota más reciente, o `undefined` si GCS no la tiene.
 * @property esCli               - `true` si es el paquete `@mr/cli`.
 * @property esLegacy            - `true` si es un paquete legacy de `framework/`.
 * @property tieneCambiosLocales - `true` si el árbol de ficheros local difiere del último estado publicado.
 * @property versionesRemota     - Historial de versiones publicadas (de `stable.txt`).
 */
export interface IPaqueteGestion {
    tipo: "" | "core" | "user" | "legacy";
    nombre: string;
    npmName: string;
    localDir: string;
    paquete: Paquete;
    instalado: boolean;
    tieneUpdate: boolean;
    versionLocal: string | undefined;
    versionLatest: string | undefined;
    esCli: boolean;
    esLegacy: boolean;
    tieneCambiosLocales: boolean;
    versionesRemota: string[];
}

/**
 * Configuración de {@link listarNombresGCS}.
 *
 * @property bucket - Nombre del bucket GCS. Por defecto `"meteored-yarn-packages"`.
 */
interface IListarNombresGCSConfig {
    bucket?: string;
}

/**
 * Configuración de {@link construirInfoPaquetes}.
 *
 * @property checkCambios   - Si `true` (por defecto), comprueba si hay cambios locales sin publicar.
 * @property bucket         - Nombre del bucket GCS. Por defecto `"meteored-yarn-packages"`.
 * @property soloInstalados - Si `true`, solo incluye paquetes con directorio local presente.
 */
interface IConstruirInfoPaquetesConfig {
    checkCambios?: boolean;
    bucket?: string;
    soloInstalados?: boolean;
}

/**
 * Lista los nombres de los paquetes disponibles en un subdirectorio GCS.
 *
 * @param subdir - Prefijo GCS (e.g. `"@mr/core"`).
 * @param config - Configuración opcional ({bucket}).
 */
export async function listarNombresGCS(subdir: string, config: IListarNombresGCSConfig = {}): Promise<string[]> {
    const {bucket = "meteored-yarn-packages"} = config;
    const storage = new Storage();
    try {
        const [, , fws] = await storage.bucket(bucket).getFiles({
            delimiter: "/",
            prefix:    `${subdir}/`,
        });
        const {prefixes} = fws as {prefixes: string[]};
        return prefixes
            .map(p => p.replace(`${subdir}/`, "").replace(/\/$/, "").split("/")[0])
            .filter(Boolean);
    } catch {
        return [];
    }
}

async function procesarNombresPaquetes(tipo: "core" | "user", gcsPrefix: string, shortNamePrefix: string, npmPrefix: string, paqueteTipo: PaqueteTipo, basedir: string, bucket: string, soloInstalados: boolean, infos: IPaqueteGestion[]): Promise<void> {
    const localBase = `${basedir}/${gcsPrefix}`;
    let names: string[];
    if (soloInstalados) {
        names = await isDir(localBase) ? await readDir(localBase) : [];
    } else {
        const gcsNames = await listarNombresGCS(gcsPrefix, {bucket});
        const localRawNames = await isDir(localBase) ? await readDir(localBase) : [];
        const gcsShortNames = new Set(gcsNames.map(n => n.startsWith(shortNamePrefix) ? n.slice(shortNamePrefix.length) : n));
        names = [...gcsNames];
        for (const localName of localRawNames) {
            const localShortName = localName.startsWith(shortNamePrefix) ? localName.slice(shortNamePrefix.length) : localName;
            if (!gcsShortNames.has(localShortName)) {
                names.push(localName);
            }
        }
    }

    for (const gcsName of names) {
        const shortName = gcsName.startsWith(shortNamePrefix) ? gcsName.slice(shortNamePrefix.length) : gcsName;
        const npmName   = `${npmPrefix}${shortName}`;
        const localDir  = `${localBase}/${shortName}`;
        if (soloInstalados && !await isFile(`${localDir}/package.json`)) {
            continue;
        }
        const instalado = soloInstalados || await isFile(`${localDir}/package.json`);
        const paquete   = instalado
            ? await Paquete.build(localDir).catch(() => Paquete.buildVirtual(npmName, paqueteTipo, bucket))
            : Paquete.buildVirtual(npmName, paqueteTipo, bucket);
        infos.push({
            tipo, nombre: shortName, npmName, localDir,
            paquete, instalado, tieneUpdate: false,
            versionLocal: instalado ? paquete.versionPublica : undefined,
            versionLatest: undefined, esCli: false, esLegacy: false,
            tieneCambiosLocales: false, versionesRemota: [],
        });
    }
}

/**
 * Carga la información completa de todos los paquetes del monorepo.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param config  - Configuración opcional ({checkCambios, bucket, soloInstalados}).
 */
export async function construirInfoPaquetes(basedir: string, config: IConstruirInfoPaquetesConfig = {}): Promise<IPaqueteGestion[]> {
    const {checkCambios = true, bucket = "meteored-yarn-packages", soloInstalados = false} = config;
    const infos: IPaqueteGestion[] = [];

    const cliDir       = `${basedir}/@mr/cli`;
    const cliInstalado = await isFile(`${cliDir}/package.json`);
    const cliPaquete   = cliInstalado
        ? await Paquete.build(cliDir).catch(() => Paquete.buildVirtual("@mr/cli", PaqueteTipo.root, bucket))
        : Paquete.buildVirtual("@mr/cli", PaqueteTipo.root, bucket);
    infos.push({
        tipo: "", nombre: "cli", npmName: "@mr/cli", localDir: cliDir,
        paquete: cliPaquete, instalado: cliInstalado,
        tieneUpdate: false, versionLocal: cliInstalado ? cliPaquete.versionPublica : undefined,
        versionLatest: undefined, esCli: true, esLegacy: false,
        tieneCambiosLocales: false, versionesRemota: [],
    });

    await procesarNombresPaquetes("core", "@mr/core", "core-", "@mr/core-", PaqueteTipo.core, basedir, bucket, soloInstalados, infos);
    await procesarNombresPaquetes("user", "@mr/user", "user-", "@mr/user-", PaqueteTipo.user, basedir, bucket, soloInstalados, infos);

    const frameworkDir = `${basedir}/framework`;
    if (await isDir(frameworkDir)) {
        for (const dir of await readDir(frameworkDir)) {
            if (!dir.startsWith("services-")) {
                continue;
            }
            const localDir = `${frameworkDir}/${dir}`;
            if (!await isFile(`${localDir}/package.json`)) {
                continue;
            }
            const paquete = await Paquete.build(localDir).catch(() => null);
            if (paquete === null) {
                continue;
            }
            infos.push({
                tipo: "legacy", nombre: dir, npmName: dir, localDir,
                paquete, instalado: true, tieneUpdate: false,
                versionLocal: paquete.versionPublica,
                versionLatest: undefined, esCli: false, esLegacy: true,
                tieneCambiosLocales: false, versionesRemota: [],
            });
        }
    }

    await Promise.all(infos.map(async (info) => {
        const [check, cambiosLocales, versionesRemota] = await Promise.all([
            info.paquete.checkUpdate().catch(() => undefined),
            checkCambios && info.instalado && info.paquete.esSubible
                ? info.paquete.checkCambiosLocales().catch(() => false)
                : Promise.resolve(false),
            info.paquete.getVersionesRemota().catch(() => [] as string[]),
        ]);

        if (check !== undefined) {
            info.tieneUpdate   = true;
            info.versionLatest = check;
        } else if (info.instalado) {
            info.tieneUpdate   = false;
            info.versionLatest = await info.paquete.getVersionRemota().catch(() => undefined);
        }

        info.tieneCambiosLocales = cambiosLocales;
        info.versionesRemota = versionesRemota;
    }));

    return infos;
}

