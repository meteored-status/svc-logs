/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 791c49ee2a1ede0524509f445f4ee587
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {dump as yamlDump, load as yamlLoad} from "js-yaml";

import {readFileString, safeWrite} from "../../../utiles/fs";
import {Colors} from "../colors";
import {Log} from "../log";

/**
 * Estructura tipada del fichero `.yarnrc.yml`.
 *
 * @property approvedGitRepositories - Lista de repositorios git autorizados.
 * @property checksumBehavior        - Comportamiento ante checksums incorrectos (`"throw"` o `false`).
 * @property compressionLevel        - Nivel de compresión del caché (`mixed`, `normal`, etc.).
 * @property enableGlobalCache       - Si `true`, usa la caché global de Yarn.
 * @property enableHardenedMode      - Si `true`, activa el modo endurecido de Yarn.
 * @property enableScripts           - Si `false`, deshabilita los scripts de instalación.
 * @property enableStrictSsl         - Si `true`, fuerza la validación estricta de certificados SSL.
 * @property npmMinimalAgeGate       - Edad mínima de un paquete npm para ser instalado (minutos).
 * @property packageExtensions       - Extensiones de dependencias de paquetes de terceros.
 * @property plugins                 - Plugins de Yarn activos.
 * @property unsafeHttpWhitelist     - Lista de hosts permitidos por HTTP sin cifrar.
 * @property yarnPath                - Ruta al ejecutable de Yarn.
 */
interface IYarnRC {
    approvedGitRepositories?: string[];
    checksumBehavior?: "throw"|false;
    compressionLevel?: string;
    enableGlobalCache?: boolean;
    enableHardenedMode?: boolean;
    enableStrictSsl?: boolean;
    enableScripts?: boolean;
    npmMinimalAgeGate?: number;
    packageExtensions?: Record<string, {dependencies?: Record<string, string>}>;
    plugins?: unknown[];
    unsafeHttpWhitelist?: string[];
    yarnPath?: string;
}

/**
 * Normaliza `.yarnrc.yml` con la configuración de seguridad/caché esperada del monorepo
 * (repositorios git aprobados, modo endurecido, checksum estricto, SSL estricto,
 * edad mínima de paquetes npm, extensiones de paquetes de terceros).
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @returns `true` si se modificó el fichero.
 */
export async function initYarnRC(basedir: string): Promise<boolean> {
    Log.group({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgWhite], "Inicializando configuración de YARN"));

    const filePath = `${basedir}/.yarnrc.yml`;
    const config = yamlLoad(await readFileString(filePath)) as IYarnRC;

    let cambio = false;

    // Asegurar campos requeridos
    if (config.approvedGitRepositories === undefined || config.approvedGitRepositories.length > 0) {
        config.approvedGitRepositories = [];
    }
    if (config.enableHardenedMode !== true) {
        config.enableHardenedMode = true;
        cambio = true;
    }
    if (config.checksumBehavior !== "throw") {
        config.checksumBehavior = "throw";
        cambio = true;
    }
    if (config.enableStrictSsl !== true) {
        config.enableStrictSsl = true;
        cambio = true;
    }
    if (config.npmMinimalAgeGate !== 1440) {
        config.npmMinimalAgeGate = 1440;
        cambio = true;
    }
    if (!config.unsafeHttpWhitelist || config.unsafeHttpWhitelist.length > 0) {
        config.unsafeHttpWhitelist = [];
        cambio = true;
    }

    // Librerías a añadir en packageExtensions (vacío por ahora)
    const libs: Record<string, string> = {};
    // Librerías obsoletas a eliminar de packageExtensions
    const exlibs = [
        "@google-cloud/opentelemetry-cloud-trace-exporter",
        "@google-cloud/opentelemetry-resource-util",
        "@inquirer/core",
        "mysql2",
    ];

    const extensions = {...(config.packageExtensions ?? {})};

    for (const [lib, dep] of Object.entries(libs).sort()) {
        const key = `${lib}@*`;
        if (extensions[key] === undefined) {
            extensions[key] = {dependencies: {[dep]: "*"}};
            cambio = true;
        }
    }

    for (const lib of exlibs) {
        const key = `${lib}@*`;
        if (key in extensions) {
            delete extensions[key];
            cambio = true;
        }
    }

    if (Object.keys(extensions).length > 0) {
        config.packageExtensions = extensions;
    } else {
        if (config.packageExtensions !== undefined) cambio = true;
        delete config.packageExtensions;
    }

    if (cambio) {
        const yaml = yamlDump(config, {lineWidth: -1, sortKeys: true})
            .replace(/^([a-zA-Z])/gm, "\n$1")
            .replace(/^\n/, "");
        await safeWrite(filePath, yaml, true);
    }

    Log.groupEnd();

    return cambio;
}
