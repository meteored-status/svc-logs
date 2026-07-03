/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 30 Jun 2026 10:32:49 GMT
 * Hash: 3997add0aa810a6aff20f27a9c186772
 * Versión: 2026.6.30+3-josantoniojimnez
 * Anterior: 2026.6.30+2-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-ads.git
 */

import {Colors} from "../colors";
import {cargarConfig, existeI18n, guardarConfig, type IInfoWorkspace, listarWorkspacesConInfo} from "./datos";
import {alternarLista, elegirUno, seleccionar} from "./menu";

/** Clave de configuración gestionada por la lista de alternancia. */
type ClaveLista = "packd" | "devel";

/**
 * Devuelve los workspaces relevantes para la clave indicada, aplicando los filtros de capacidad:
 * - `packd` (compilar): excluye workspaces con `compilable === false` (runtime = "php").
 * - `devel` (ejecutar): excluye workspaces con `ejecutable === false` (runtime = "browser", "cfworker" o "php").
 *
 * @param infos - Lista completa de workspaces con sus capacidades.
 * @param clave - Clave de configuración a gestionar.
 * @returns Subconjunto filtrado.
 */
function filtrarPorClave(infos: IInfoWorkspace[], clave: ClaveLista): IInfoWorkspace[] {
    return clave === "packd"
        ? infos.filter(info => info.compilable)
        : infos.filter(info => info.ejecutable);
}

/**
 * Gestiona la lista de workspaces de una clave (`packd` para compilar, `devel` para ejecutar).
 *
 * Muestra una lista de alternancia con los workspaces compatibles: marcado = habilitado
 * (`available`), desmarcado = deshabilitado (`disabled`). Los workspaces sin capacidad para
 * la operación (p.ej. `php` en compilar; `browser`, `cfworker` o `php` en ejecutar) no se
 * muestran y se eliminan de ambas listas al guardar.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param clave   - Clave de configuración a gestionar.
 * @param titulo  - Título mostrado en la cabecera.
 */
async function gestionarLista(basedir: string, clave: ClaveLista, titulo: string): Promise<void> {
    const [config, infos] = await Promise.all([
        cargarConfig(basedir),
        listarWorkspacesConInfo(basedir),
    ]);
    const relevantes = filtrarPorClave(infos, clave);

    if (relevantes.length === 0) {
        console.log(Colors.colorize([Colors.FgYellow], "No se encontraron workspaces gestionables"));
        return;
    }

    const disabled = config[clave].disabled;
    const items = relevantes.map(info => ({
        label: info.nombre,
        checked: !disabled.includes(info.nombre),
    }));

    const subtitulo = clave === "packd"
        ? "ON = se compila · OFF = no se compila"
        : "ON = se ejecuta · OFF = no se ejecuta";

    const resultado = await alternarLista(`${titulo} — ${subtitulo}`, items);
    if (resultado === null) {
        return;
    }

    const available: string[] = [];
    const nuevoDisabled: string[] = [];
    for (const [i, info] of relevantes.entries()) {
        if (resultado[i]) {
            available.push(info.nombre);
        } else {
            nuevoDisabled.push(info.nombre);
        }
    }

    config[clave] = {available, disabled: nuevoDisabled};
    await guardarConfig(basedir, config);

    console.log(Colors.colorize([Colors.FgGreen, Colors.Bright], `✓ ${titulo}: configuración guardada`));
}

/**
 * Gestiona la opción de generación del workspace `i18n`.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
async function gestionarI18n(basedir: string): Promise<void> {
    const config = await cargarConfig(basedir);

    const resultado = await elegirUno(
        "Generar i18n — generación del workspace i18n",
        [
            {label: "ON",  value: true,  descripcion: "genera el workspace i18n en cada compilación"},
            {label: "OFF", value: false, descripcion: "omite la generación del workspace i18n"},
        ],
        {inicial: config.i18n ? 0 : 1},
    );
    if (resultado === null || resultado === config.i18n) {
        return;
    }

    config.i18n = resultado;
    await guardarConfig(basedir, config);

    console.log(Colors.colorize([Colors.FgGreen, Colors.Bright], `✓ Generar i18n: ${resultado ? "activado" : "desactivado"}`));
}

/**
 * Submenú de gestión de workspaces de `config.workspaces.json`.
 *
 * Ofrece tres acciones: gestionar los workspaces a ejecutar (`devel`), a compilar (`packd`)
 * y la selección ON/OFF de generación de `i18n` (habilitada solo si el workspace existe).
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function gestionarWorkspaces(basedir: string): Promise<void> {
    while (true) {
        const hayI18n = await existeI18n(basedir);

        const opcion = await seleccionar("Gestionar workspaces", [
            {label: "Ejecutar", value: "ejecutar", descripcion: "workspaces a ejecutar"},
            {label: "Compilar", value: "compilar", descripcion: "workspaces a compilar"},
            {
                label: "Generar i18n",
                value: "i18n",
                descripcion: hayI18n ? "generación del workspace i18n" : "(workspace i18n no disponible)",
                disabled: !hayI18n,
            },
            {label: "Volver", value: "volver"},
        ]);

        if (opcion === null || opcion === "volver") {
            return;
        }

        switch (opcion) {
            case "compilar":
                await gestionarLista(basedir, "packd", "Compilar");
                break;
            case "ejecutar":
                await gestionarLista(basedir, "devel", "Ejecutar");
                break;
            case "i18n":
                await gestionarI18n(basedir);
                break;
        }
    }
}

