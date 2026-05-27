/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 8ba4ff3a208435d2aa0f5bcbe9d6f8a0
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import {mkdir, safeWrite, unlink} from "services-comun/modules/utiles/fs";

import {Colors} from "../../colors";
import {Paquete, PaqueteTipo} from "../../paquete";
import {FrameworkUpdates} from "../../workspace/service";
import {getAutor, getClienteHash, recompilarCliente} from "../cliente";
import {install} from "../../yarn";
import {Accion, type IPaqueteGestion} from "./datos";
import {escribirLog, escribirLogPush} from "./logs";
import {GestorTabla} from "./tabla";

/**
 * Configuración de {@link ejecutarAcciones}.
 *
 * @property reiniciar - Si `true` (por defecto), reinicia el proceso tras recompilar `@mr/cli`.
 */
interface IEjecutarAccionesConfig {
    reiniciar?: boolean;
}

/**
 * Ejecuta las acciones seleccionadas sobre los paquetes indicados.
 *
 * @param basedir     - Raíz absoluta del monorepo.
 * @param infos       - Lista de paquetes con su estado.
 * @param accionesArr - Acción para cada índice de `infos`.
 * @param config      - Configuración opcional ({reiniciar}).
 * @returns `true` si se produjo algún cambio efectivo.
 */
export async function ejecutarAcciones(basedir: string, infos: IPaqueteGestion[], accionesArr: Accion[], config: IEjecutarAccionesConfig = {}): Promise<boolean> {
    const {reiniciar = true} = config;
    const aInstalar:        IPaqueteGestion[] = [];
    const aActualizar:      IPaqueteGestion[] = [];
    const aResetear:        IPaqueteGestion[] = [];
    const aDesinstalar:     IPaqueteGestion[] = [];
    const aEnviar:          IPaqueteGestion[] = [];
    const aEnviarConUpdate: IPaqueteGestion[] = [];

    for (let i = 0; i < infos.length; i++) {
        switch (accionesArr[i]) {
            case Accion.Instalar:        aInstalar.push(infos[i]);        break;
            case Accion.Actualizar:      aActualizar.push(infos[i]);      break;
            case Accion.Resetear:        aResetear.push(infos[i]);        break;
            case Accion.Desinstalar:     aDesinstalar.push(infos[i]);     break;
            case Accion.Enviar:          aEnviar.push(infos[i]);          break;
            case Accion.EnviarConUpdate: aEnviarConUpdate.push(infos[i]); break;
        }
    }

    if (aInstalar.length === 0 && aActualizar.length === 0 && aResetear.length === 0
            && aDesinstalar.length === 0 && aEnviar.length === 0 && aEnviarConUpdate.length === 0) {
        console.log(Colors.colorize([Colors.FgGreen, Colors.Bright], "Nada que hacer"));
        return false;
    }

    // Bootstrap de paquetes a instalar en paralelo
    await Promise.all(aInstalar.map(async info => {
        if (info.versionLatest !== undefined) {
            const tipo = info.tipo === "core" ? PaqueteTipo.core
                       : info.tipo === "user" ? PaqueteTipo.user
                       : PaqueteTipo.root;
            await mkdir(info.localDir, true);
            await safeWrite(`${info.localDir}/package.json`, `${JSON.stringify({
                name: info.npmName,
                version: "0.0.0+0-new",
                config: {subible: true, tipo},
            }, null, 2)}\n`);
            info.paquete   = await Paquete.build(info.localDir);
            info.instalado = true;
        }
    }));

    // Configurar consola de progreso para instalaciones y actualizaciones
    const aProgreso = [...aInstalar, ...aActualizar]
        .filter(i => i.instalado && i.versionLatest !== undefined)
        .map(i => i.paquete);
    if (aProgreso.length > 0) {
        Paquete.setupConsolaParaUpdate(aProgreso);
    }

    let cambio = false;
    let cliActualizado = false;
    const avisos: string[] = [];
    const aConflictoUpdate:           IPaqueteGestion[] = [];
    const aConflictoEnviarConUpdate:  IPaqueteGestion[] = [];

    // Instalaciones y actualizaciones en paralelo
    await Promise.all([
        ...aInstalar
            .filter(i => i.instalado)
            .map(async info => {
                const {cambio: aplicado, entradas} = await info.paquete.applyUpdate(info.versionLatest!);
                if (aplicado) { cambio = true; }
                if (entradas.length > 0) {
                    await escribirLog(basedir, info, entradas, info.paquete.logs);
                }
            }),
        ...aActualizar
            .filter(i => i.versionLatest !== undefined)
            .map(async info => {
                const {cambio: aplicado, conflictos, entradas} = await info.paquete.applyUpdate(info.versionLatest!);
                if (aplicado) {
                    cambio = true;
                    if (info.esCli) { cliActualizado = true; }
                }
                if (entradas.length > 0) {
                    const logPath = await escribirLog(basedir, info, entradas, info.paquete.logs);
                    if (conflictos) {
                        avisos.push(`⚠  ${info.npmName}: merge con conflictos — ver ${logPath}`);
                        aConflictoUpdate.push(info);
                    }
                } else if (conflictos) {
                    aConflictoUpdate.push(info);
                }
            }),
    ]);

    // Resets en paralelo
    if (aResetear.length > 0) {
        Paquete.setupConsolaParaUpdate(aResetear.map(i => i.paquete));
    }
    await Promise.all(aResetear.map(async info => {
        await info.paquete.reset();
        if (info.esCli) { cliActualizado = true; }
    }));

    // Desinstalaciones en paralelo
    await Promise.all(aDesinstalar.map(async info => {
        await unlink(info.localDir);
        cambio = true;
        console.log(Colors.colorize([Colors.FgYellow], `Desinstalado ${info.npmName}`));
    }));

    // Reinstalar dependencias cuando hubo acciones que pueden tocar manifests/locks
    const necesitaInstall = aInstalar.length > 0 || aDesinstalar.length > 0
        || aActualizar.length > 0 || aResetear.length > 0;
    let installHecho = false;
    if (necesitaInstall) {
        await install(basedir, {verbose: false});
        installHecho = true;
    }

    // Recompilar CLI si fue modificado
    if (cliActualizado) {
        await recompilarCliente(basedir, await getClienteHash(basedir), {reiniciar, skipInstall: installHecho});
    }

    // Obtener autor una sola vez para todos los envíos
    const autor = (aEnviar.length > 0 || aEnviarConUpdate.length > 0) ? await getAutor() : "";

    // Envíos directos en paralelo
    if (aEnviar.length > 0) {
        Paquete.setupConsolaParaUpdate(aEnviar.map(i => i.paquete));
        await Promise.all(aEnviar.map(async info => {
            await info.paquete.push(autor);
            cambio = true;
            if (info.paquete.logs.length > 0) {
                await escribirLogPush(basedir, info, info.paquete.logs);
            }
        }));
    }

    // Actualizar + enviar en paralelo: por cada paquete, update → push secuenciales entre sí
    if (aEnviarConUpdate.length > 0) {
        Paquete.setupConsolaParaUpdate(aEnviarConUpdate.map(i => i.paquete));

        await Promise.all(aEnviarConUpdate.map(async info => {
            const {cambio: aplicado, conflictos, entradas} = await info.paquete.applyUpdate(info.versionLatest!);
            if (aplicado) {
                cambio = true;
                if (info.esCli) { cliActualizado = true; }
            }
            let logPath: string | undefined;
            if (entradas.length > 0) {
                logPath = await escribirLog(basedir, info, entradas, info.paquete.logs);
            }

            if (!conflictos) {
                await info.paquete.push(autor);
                cambio = true;
                if (info.paquete.logs.length > 0) {
                    await escribirLogPush(basedir, info, info.paquete.logs);
                }
            } else {
                aConflictoEnviarConUpdate.push(info);
                if (logPath !== undefined) {
                    avisos.push(`⚠  ${info.npmName}: merge con conflictos — ver ${logPath}`);
                } else {
                    avisos.push(`⚠  ${info.npmName}: el merge generó conflictos — revisa los ficheros marcados antes de enviar.`);
                }
            }
        }));
    }

    // Tabla de conflictos: si algún update produjo conflictos de merge, ofrecer resetear.
    const aConflicto = [...aConflictoUpdate, ...aConflictoEnviarConUpdate];
    if (aConflicto.length > 0) {
        const defaultsConflicto: Accion[] = [
            ...aConflictoUpdate.map(() => Accion.Resetear),
            ...aConflictoEnviarConUpdate.map(() => Accion.Nada),
        ];

        console.log("");
        console.log(Colors.colorize([Colors.FgYellow, Colors.Bright],
            `${aConflicto.length} paquete(s) con conflictos de merge — ¿deseas resetearlos a la versión publicada?`,
        ));
        console.log("");
        const tablaConflictos = new GestorTabla(aConflicto, {modo: "reset", frameworkUpdates: FrameworkUpdates.all, defaultAcciones: defaultsConflicto});
        const resultadoConflictos = await tablaConflictos.run();
        console.log("");

        if (resultadoConflictos !== null) {
            const aResetearConflictos = aConflicto.filter((_, i) => resultadoConflictos[i] === Accion.Resetear);
            if (aResetearConflictos.length > 0) {
                Paquete.setupConsolaParaUpdate(aResetearConflictos.map(i => i.paquete));
                let conflictoCli = false;
                await Promise.all(aResetearConflictos.map(async info => {
                    await info.paquete.reset();
                    cambio = true;
                    if (info.esCli) {
                        conflictoCli = true;
                    }
                }));
                await install(basedir, {verbose: false});
                if (conflictoCli) {
                    await recompilarCliente(basedir, await getClienteHash(basedir), {reiniciar, skipInstall: true});
                }
            }
        }
    }

    for (const aviso of avisos) {
        console.log(Colors.colorize([Colors.FgYellow, Colors.Bright], aviso));
    }

    return cambio;
}

