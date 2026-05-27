/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: fbab196adcca9af16bbf44cca005aff9
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import {Colors} from "../../colors";
import {FrameworkUpdates} from "../../workspace/service";
import {ejecutarAcciones} from "./acciones";
import {Accion, construirInfoPaquetes, type IPaqueteGestion} from "./datos";
import {GestorTabla} from "./tabla";

/**
 * Configuración de {@link gestionar}.
 *
 * @property reiniciar - Si `true` (por defecto), reinicia el proceso tras recompilar `@mr/cli`.
 */
interface IGestionarConfig {
    reiniciar?: boolean;
}

/**
 * Configuración de {@link actualizarTodo}.
 *
 * @property forzar           - Si `true`, aplica el update sin mostrar la tabla interactiva.
 * @property reiniciar        - Si `true` (por defecto), reinicia el proceso tras recompilar `@mr/cli`.
 * @property frameworkUpdates - Política de auto-preselección de paquetes. Por defecto `all`.
 */
interface IActualizarTodoConfig {
    forzar?: boolean;
    reiniciar?: boolean;
    frameworkUpdates?: FrameworkUpdates;
}

/**
 * Configuración de {@link enviarTodo}.
 *
 * @property forzar    - Si `true` (por defecto), aplica el envío sin mostrar la tabla.
 * @property reiniciar - Si `true` (por defecto), reinicia el proceso tras recompilar `@mr/cli`.
 */
interface IEnviarTodoConfig {
    forzar?: boolean;
    reiniciar?: boolean;
}

/**
 * Configuración de {@link resetearTodo}.
 *
 * @property forzar    - Si `true` (por defecto), resetea todos sin mostrar la tabla.
 * @property reiniciar - Si `true` (por defecto), reinicia el proceso tras recompilar `@mr/cli`.
 */
interface IResetearTodoConfig {
    forzar?: boolean;
    reiniciar?: boolean;
}

/**
 * Gestor interactivo de frameworks.
 *
 * Muestra una tabla completa de los paquetes `@mr/cli`, `@mr/core/*` y `@mr/user/*`
 * con su versión instalada y la disponible en GCS. El usuario navega con ↑↓ entre
 * paquetes y cambia la acción con ←→. Al pulsar Intro se aplican todos los cambios.
 *
 * Antes de ejecutar cualquier envío, verifica que la versión remota sigue siendo la
 * misma que se cargó al abrir la tabla. Si alguien publicó en el ínterin, recarga la
 * tabla automáticamente para que el usuario tome la decisión con datos frescos.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param config  - Configuración opcional ({reiniciar}).
 * @returns `true` si se aplicó algún cambio.
 */
export async function gestionar(basedir: string, config: IGestionarConfig = {}): Promise<boolean> {
    const {reiniciar = true} = config;
    console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Cargando paquetes..."));
    let infos = await construirInfoPaquetes(basedir);

    while (true) {
        if (infos.length === 0) {
            console.log(Colors.colorize([Colors.FgYellow], "No se encontraron paquetes"));
            return false;
        }

        console.log("");
        const tabla = new GestorTabla(infos);
        const accionesArr = await tabla.run();
        console.log("");

        if (accionesArr === null) {
            console.log(Colors.colorize([Colors.FgYellow], "Cancelado"));
            return false;
        }

        // Verificar que la versión remota no haya cambiado para los paquetes por enviar
        const idxEnviar = accionesArr
            .map((a, i) => (a === Accion.Enviar || a === Accion.EnviarConUpdate ? i : -1))
            .filter(i => i !== -1);

        if (idxEnviar.length > 0) {
            const hayConflicto = (await Promise.all(
                idxEnviar.map(async i => {
                    const info = infos[i];
                    info.paquete.invalidarCacheVersion();
                    const latestActual = await info.paquete.getVersionRemota().catch(() => undefined);
                    return latestActual !== info.versionLatest;
                }),
            )).some(Boolean);

            if (hayConflicto) {
                console.log(Colors.colorize([Colors.FgYellow, Colors.Bright],
                    "⚠  La versión remota ha cambiado desde que se cargó la tabla. Recargando..."));
                infos = await construirInfoPaquetes(basedir);
                continue;
            }
        }

        return ejecutarAcciones(basedir, infos, accionesArr, {reiniciar});
    }
}

/**
 * Actualiza los paquetes instalados con versión remota disponible.
 *
 * - **Modo interactivo** (`forzar = false`): muestra la tabla en modo restringido
 *   con todos los paquetes que tienen update preseleccionados. Si no hay interacción
 *   en 5 segundos se confirma automáticamente.
 * - **Modo silencioso** (`forzar = true`): aplica el update sin mostrar la tabla.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param config  - Configuración opcional ({forzar, reiniciar, frameworkUpdates}).
 * @returns `true` si se aplicó algún cambio.
 */
export async function actualizarTodo(basedir: string, config: IActualizarTodoConfig = {}): Promise<boolean> {
    const {forzar = false, reiniciar = true, frameworkUpdates = FrameworkUpdates.all} = config;
    console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Cargando paquetes..."));
    const infos = await construirInfoPaquetes(basedir, {checkCambios: false, bucket: "meteored-yarn-packages", soloInstalados: true});

    if (infos.length === 0) {
        console.log(Colors.colorize([Colors.FgYellow], "No se encontraron paquetes"));
        return false;
    }

    const hayUpdate = infos.some(info => info.instalado && info.tieneUpdate);
    if (!hayUpdate) {
        console.log(Colors.colorize([Colors.FgGreen, Colors.Bright], "Todos los paquetes están al día"));
        return false;
    }

    let accionesArr: Accion[];

    if (forzar) {
        accionesArr = infos.map(info =>
            info.instalado && info.tieneUpdate ? Accion.Actualizar : Accion.Nada,
        );
    } else {
        console.log("");
        const tabla = new GestorTabla(infos, {modo: "update", frameworkUpdates});
        const resultado = await tabla.run({autoConfirmMs: 5000});
        console.log("");

        if (resultado === null) {
            console.log(Colors.colorize([Colors.FgYellow], "Cancelado"));
            return false;
        }
        accionesArr = resultado;
    }

    const n = accionesArr.filter(a => a === Accion.Actualizar || a === Accion.Instalar).length;
    if (n === 0) {
        console.log(Colors.colorize([Colors.FgYellow], "No se seleccionaron paquetes para actualizar"));
        return false;
    }

    console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], `Actualizando ${n} paquete(s)...`));
    return ejecutarAcciones(basedir, infos, accionesArr, {reiniciar});
}

/**
 * Envía los paquetes con cambios locales.
 *
 * - **Modo interactivo** (`forzar = false`): muestra la tabla en modo `"send"`,
 *   filtrando solo los paquetes con cambios locales.
 * - **Modo silencioso** (`forzar = true`): aplica el envío sin mostrar la tabla.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param config  - Configuración opcional ({forzar, reiniciar}).
 * @returns `true` si se aplicó algún cambio.
 */
export async function enviarTodo(basedir: string, config: IEnviarTodoConfig = {}): Promise<boolean> {
    const {forzar = true, reiniciar = true} = config;
    console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Cargando paquetes..."));
    const infos = await construirInfoPaquetes(basedir, {checkCambios: true, bucket: "meteored-yarn-packages", soloInstalados: true});

    if (infos.length === 0) {
        console.log(Colors.colorize([Colors.FgYellow], "No se encontraron paquetes"));
        return false;
    }

    let accionesArr: Accion[];

    if (forzar) {
        accionesArr = infos.map(info => {
            if (GestorTabla.tieneEnviarConUpdate(info)) { return Accion.EnviarConUpdate; }
            if (GestorTabla.tieneEnviar(info)) { return Accion.Enviar; }
            return Accion.Nada;
        });
    } else {
        const filtrados = infos.filter(i => GestorTabla.tieneEnviar(i) || GestorTabla.tieneEnviarConUpdate(i));
        if (filtrados.length === 0) {
            console.log(Colors.colorize([Colors.FgGreen, Colors.Bright], "No hay paquetes con cambios locales pendientes de enviar"));
            return false;
        }
        console.log("");
        const tabla = new GestorTabla(filtrados, {modo: "send"});
        const resultado = await tabla.run();
        console.log("");

        if (resultado === null) {
            console.log(Colors.colorize([Colors.FgYellow], "Cancelado"));
            return false;
        }

        accionesArr = infos.map((info: IPaqueteGestion) => {
            const idx = filtrados.indexOf(info);
            if (idx === -1) { return Accion.Nada; }
            return resultado[idx];
        });
    }

    const n = accionesArr.filter(a => a === Accion.Enviar || a === Accion.EnviarConUpdate).length;
    if (n === 0) {
        console.log(Colors.colorize([Colors.FgGreen, Colors.Bright], "No hay paquetes con cambios locales pendientes de enviar"));
        return false;
    }

    console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], `Enviando ${n} paquete(s)...`));
    return ejecutarAcciones(basedir, infos, accionesArr, {reiniciar});
}

/**
 * Resetea los paquetes instalados.
 *
 * - **Modo interactivo** (`forzar = false`): muestra la tabla en modo `"reset"`.
 * - **Modo silencioso** (`forzar = true`): resetea todos sin mostrar la tabla.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param config  - Configuración opcional ({forzar, reiniciar}).
 * @returns `true` si se aplicó algún cambio.
 */
export async function resetearTodo(basedir: string, config: IResetearTodoConfig = {}): Promise<boolean> {
    const {forzar = true, reiniciar = true} = config;
    console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], "Cargando paquetes..."));
    const infos = await construirInfoPaquetes(basedir, {checkCambios: false, bucket: "meteored-yarn-packages", soloInstalados: true});

    if (infos.length === 0) {
        console.log(Colors.colorize([Colors.FgYellow], "No se encontraron paquetes"));
        return false;
    }

    let accionesArr: Accion[];

    if (forzar) {
        accionesArr = infos.map(info =>
            info.instalado ? Accion.Resetear : Accion.Nada,
        );
    } else {
        const filtrados = infos.filter(i => i.instalado);
        if (filtrados.length === 0) {
            console.log(Colors.colorize([Colors.FgYellow], "No hay paquetes instalados para resetear"));
            return false;
        }
        console.log("");
        const tabla = new GestorTabla(filtrados, {modo: "reset"});
        const resultado = await tabla.run();
        console.log("");

        if (resultado === null) {
            console.log(Colors.colorize([Colors.FgYellow], "Cancelado"));
            return false;
        }

        accionesArr = infos.map((info: IPaqueteGestion) => {
            const idx = filtrados.indexOf(info);
            if (idx === -1) { return Accion.Nada; }
            return resultado[idx];
        });
    }

    const n = accionesArr.filter(a => a === Accion.Resetear).length;
    if (n === 0) {
        console.log(Colors.colorize([Colors.FgYellow], "No hay paquetes instalados para resetear"));
        return false;
    }

    console.log(Colors.colorize([Colors.FgCyan, Colors.Bright], `Reseteando ${n} paquete(s)...`));
    return ejecutarAcciones(basedir, infos, accionesArr, {reiniciar});
}

