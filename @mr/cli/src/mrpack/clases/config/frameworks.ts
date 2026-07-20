/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 20 Jul 2026 06:26:44 GMT
 * Hash: 3ed2f8ef1fe844303be43170b0ae711d
 * Versión: 2026.7.20+1-josantoniojimnez
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {Colors} from "../colors";
import {Log} from "../log";
import {FrameworkUpdates} from "../workspace/service";
import {cargarConfig, guardarConfig} from "./datos";
import {elegirUno, seleccionar} from "./menu";

/**
 * Gestiona la programación de autoupdates de frameworks (`framework.updates`).
 *
 * Muestra un selector de radio con las tres políticas disponibles, arrancando
 * sobre la que está actualmente configurada.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
async function gestionarAutoupdates(basedir: string): Promise<void> {
    const config = await cargarConfig(basedir);
    const actual = config.framework?.updates ?? FrameworkUpdates.all;

    const opciones = [
        {value: FrameworkUpdates.all,    descripcion: "comprobar en cada arranque"},
        {value: FrameworkUpdates.daily,  descripcion: "comprobar como máximo una vez al día"},
        {value: FrameworkUpdates.weekly, descripcion: "comprobar como máximo una vez a la semana"},
    ];

    const resultado = await elegirUno(
        "Autoupdates — frecuencia de comprobación de actualizaciones",
        opciones.map(o => ({label: o.value, value: o.value, descripcion: o.descripcion})),
        {inicial: opciones.findIndex(o => o.value === actual)},
    );

    if (resultado === null || resultado === actual) {
        return;
    }

    config.framework = {updates: resultado};
    await guardarConfig(basedir, config);

    Log.info({type: Log.label_base, label: "frameworks"}, Colors.colorize([Colors.FgGreen, Colors.Bright], `✓ Autoupdates: ${resultado}`));
}

/**
 * Gestiona el sistema de patches (`framework.patch`).
 *
 * Muestra el último patch aplicado y ofrece la opción de eliminarlo del fichero,
 * lo que fuerza a que `patch:apply` vuelva a aplicar todos los patches desde el inicio.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
async function gestionarPatches(basedir: string): Promise<void> {
    const config = await cargarConfig(basedir);
    const patchActual = config.framework?.patch;
    const hayPatch = patchActual !== undefined && patchActual !== "";

    const descripcionActual = hayPatch
        ? `último patch aplicado: ${patchActual}`
        : "(sin patch registrado)";

    const resultado = await seleccionar(`Patches — ${descripcionActual}`, [
        {
            label: "Resetear",
            value: "resetear",
            descripcion: "fuerza reaplicar todos los patches en el próximo arranque",
            disabled: !hayPatch,
        },
        {label: "Cancelar", value: "cancelar"},
    ]);

    if (resultado === null || resultado === "cancelar") {
        return;
    }

    if (config.framework !== undefined) {
        delete config.framework.patch;
    }
    await guardarConfig(basedir, config);

    Log.info({type: Log.label_base, label: "frameworks"}, Colors.colorize([Colors.FgGreen, Colors.Bright], "✓ Patches: patch reseteado"));
}

/**
 * Submenú de gestión de frameworks de `config.workspaces.json`.
 *
 * Ofrece dos acciones: programación de autoupdates y gestión del sistema de patches.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function gestionarFrameworks(basedir: string): Promise<void> {
    while (true) {
        const opcion = await seleccionar("Gestionar frameworks", [
            {label: "Autoupdates", value: "autoupdates", descripcion: "frecuencia de comprobación de actualizaciones"},
            {label: "Patches", value: "patches", descripcion: "resetear el último patch aplicado"},
            {label: "Volver", value: "volver"},
        ]);

        if (opcion === null || opcion === "volver") {
            return;
        }

        switch (opcion) {
            case "autoupdates":
                await gestionarAutoupdates(basedir);
                break;
            case "patches":
                await gestionarPatches(basedir);
                break;
        }
    }
}

