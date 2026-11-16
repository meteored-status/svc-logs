/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:12 GMT
 * Hash: 876d239ab53316bac6f8a6a595124f25
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import ts from "typescript";

import {FICHERO_ROUTE_GROUP} from "./rutas";

/** Código de TypeScript «No inputs were found in config file»: no importa, el programa se crea con `main.ts` y no con `include`. */
const SIN_ENTRADAS = 18003;

/**
 * Crea el programa TypeScript de un servicio con la configuración de su `tsconfig.json`, de modo que los
 * tipos se resuelvan como en la compilación real (`strictNullChecks`, rutas, `types`...).
 *
 * @param tsconfig - Ruta absoluta al `tsconfig.json` del servicio.
 * @param main     - Ruta absoluta al fichero de entrada (`main.ts`); el resto se descubre por sus imports.
 * @throws Si el `tsconfig.json` no se puede leer, tiene errores de configuración (un `extends` que no resuelve, por
 *         ejemplo: sin esto se crearía el programa con las opciones por defecto) o el programa no incluye el fichero
 *         donde vive `RouteGroup` (sin él no se podría reconocer ninguna ruta y el documento saldría vacío).
 */
export function crearPrograma(tsconfig: string, main: string): ts.Program {
    const errores: ts.Diagnostic[] = [];
    const host: ts.ParseConfigFileHost = {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (diagnostico) => {
            errores.push(diagnostico);
        },
    };
    const parseado = ts.getParsedCommandLineOfConfigFile(tsconfig, {noEmit: true, incremental: false, composite: false, tsBuildInfoFile: undefined}, host);
    if (parseado !== undefined) {
        // Los errores de `extends`, `include`... no son «irrecuperables»: se acumulan en `parseado.errors`.
        errores.push(...parseado.errors.filter(e => e.code !== SIN_ENTRADAS));
    }
    if (parseado === undefined || errores.length > 0) {
        const detalle = errores.map(e => ts.flattenDiagnosticMessageText(e.messageText, "\n")).join("; ");
        throw new Error(`No se puede leer ${tsconfig}${detalle === "" ? "" : `: ${detalle}`}`);
    }

    const programa = ts.createProgram({rootNames: [main], options: parseado.options});
    comprobarRouteGroup(programa, tsconfig);

    return programa;
}

/**
 * Comprueba que el programa incluye el fichero de `RouteGroup` de `@mr/core-network`.
 *
 * @param programa - Programa ya creado.
 * @param tsconfig - Ruta del `tsconfig.json` (para el mensaje).
 * @throws Si el fichero no está entre los del programa.
 */
export function comprobarRouteGroup(programa: ts.Program, tsconfig: string): void {
    if (!programa.getSourceFiles().some(f => f.fileName.endsWith(FICHERO_ROUTE_GROUP))) {
        throw new Error(`El programa de ${tsconfig} no incluye ${FICHERO_ROUTE_GROUP} (@mr/core-network): no se podrían reconocer los RouteGroup`);
    }
}
