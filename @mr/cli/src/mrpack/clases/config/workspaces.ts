/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 261cedf7ab8db0e91b52bc355a60208b
 * Versión: 2026.7.14+1-josantoniojimnez
 * Anterior: 2026.6.30+3-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {Colors} from "../colors";
import {Log} from "../log";
import {flagsWorkspace} from "../workspace/service";
import {cargarConfig, existeI18n, guardarConfig, type IInfoWorkspace, listarWorkspacesConInfo} from "./datos";
import {alternarMatriz, type IFilaMatriz} from "./menu";

/** Contexto asociado a cada fila de la matriz, para saber cómo persistir su resultado. */
type ContextoFila =
    | {tipo: "i18n"}
    | {tipo: "workspace"; info: IInfoWorkspace};

/**
 * Gestión de workspaces de `config.workspaces.json` en una única pantalla.
 *
 * Muestra primero la fila `i18n` (con casillas `enabled`/`watch`, solo si el workspace existe)
 * y a continuación el resto de workspaces en orden alfabético, cada uno con las casillas
 * `compilar`/`ejecutar` que le apliquen según su capacidad (`compilable`/`ejecutable`).
 * Sin submenús: todo se edita y se guarda desde esta misma matriz.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function gestionarWorkspaces(basedir: string): Promise<void> {
    const [config, infos, hayI18n] = await Promise.all([
        cargarConfig(basedir),
        listarWorkspacesConInfo(basedir),
        existeI18n(basedir),
    ]);

    const filas: IFilaMatriz[] = [];
    const contextos: ContextoFila[] = [];

    if (hayI18n) {
        const i18n = config.workspaces?.i18n;
        filas.push({
            label: "i18n",
            checkboxes: [
                {key: "enabled", label: "enabled", checked: i18n?.enabled ?? true},
                {key: "watch", label: "watch", checked: i18n?.watch ?? false},
            ],
        });
        contextos.push({tipo: "i18n"});
    }

    for (const info of infos) {
        const flags = flagsWorkspace(config.workspaces, info.nombre);
        const checkboxes = [
            ...(info.compilable ? [{key: "compilar", label: "compilar", checked: flags.compilar ?? true}] : []),
            ...(info.ejecutable ? [{key: "ejecutar", label: "ejecutar", checked: flags.ejecutar ?? true}] : []),
        ];
        if (checkboxes.length === 0) {
            continue;
        }
        filas.push({label: info.nombre, checkboxes});
        contextos.push({tipo: "workspace", info});
    }

    if (filas.length === 0) {
        Log.info({type: Log.label_base, label: "workspaces"}, Colors.colorize([Colors.FgYellow], "No se encontraron workspaces gestionables"));
        return;
    }

    const resultado = await alternarMatriz("Gestionar workspaces", filas);
    if (resultado === null) {
        return;
    }

    config.workspaces ??= {};
    resultado.forEach((valores, i) => {
        const contexto = contextos[i];
        if (contexto.tipo === "i18n") {
            config.workspaces!.i18n = {enabled: valores["enabled"], watch: valores["watch"]};
            return;
        }
        const bucket = config.workspaces![contexto.info.grupo] ??= {};
        const flags = bucket[contexto.info.nombre] ??= {};
        if ("compilar" in valores) { flags.compilar = valores["compilar"]; }
        if ("ejecutar" in valores) { flags.ejecutar = valores["ejecutar"]; }
    });
    await guardarConfig(basedir, config);

    Log.info({type: Log.label_base, label: "workspaces"}, Colors.colorize([Colors.FgGreen, Colors.Bright], "✓ Workspaces: configuración guardada"));
}

