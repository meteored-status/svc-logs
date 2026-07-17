/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 25 Jun 2026 11:42:00 GMT
 * Hash: 628a92acb3c603a375997e8e81f3d3f1
 * Versión: 2026.6.25+10-josantoniojimnez
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
