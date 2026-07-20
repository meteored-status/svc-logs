/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 20 Jul 2026 06:26:44 GMT
 * Hash: ec07c09dab4d12b1342d3ff0539260f7
 * Versión: 2026.7.20+1-josantoniojimnez
 * Anterior: 2026.6.25+10-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {seleccionar} from "./menu";
import {gestionarFrameworks} from "./frameworks";
import {gestionarWorkspaces} from "./workspaces";

/**
 * Gestor interactivo de `config.workspaces.json` (`mrpack config`).
 *
 * Muestra el menú principal con las acciones de configuración disponibles.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function gestionar(basedir: string): Promise<void> {
    while (true) {
        const opcion = await seleccionar("Configuración del proyecto", [
            {label: "Framework", value: "frameworks", descripcion: "autoupdates · sistema de patches"},
            {label: "Workspaces", value: "workspaces", descripcion: "compilar · ejecutar · generar i18n"},
            {label: "Salir", value: "salir"},
        ]);

        if (opcion === null || opcion === "salir") {
            return;
        }

        switch (opcion) {
            case "workspaces":
                await gestionarWorkspaces(basedir);
                break;
            case "frameworks":
                await gestionarFrameworks(basedir);
                break;
        }
    }
}
