/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 02 Jul 2026 10:35:59 GMT
 * Hash: 1452935fde633dbbb4d4202dd057f7f5
 * Versión: 2026.7.2+2-josantoniojimnez
 * Anterior: 2026.6.26+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-localizacion.git
 */

import {mkdir, readFileString, safeWrite, unlink} from "services-comun/modules/utiles/fs";

import {Colors} from "../../colors";
import {Log} from "../../log";
import {Paquete, PaqueteTipo} from "../../paquete";
import {aplicarPatches} from "../../patches";
import {FrameworkUpdates} from "../../workspace/service";
import {add, getAutor, getClienteHash, leerDepsMrFramework, limpiarDevDepsConsumidores, recompilarCliente} from "../cliente";
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

    const noHayAcciones = [aInstalar, aActualizar, aResetear, aDesinstalar, aEnviar, aEnviarConUpdate].every(lista => lista.length === 0);
    if (noHayAcciones) {
        Log.info({type: Log.label_base, label: "framework"}, Colors.colorize([Colors.FgGreen, Colors.Bright], "Nada que hacer"));
        return false;
    }

    // Check preventivo: si hay envíos, validar autoría git antes de ejecutar cambios costosos.
    const requiereAutor = aEnviar.length > 0 || aEnviarConUpdate.length > 0;
    const autor = requiereAutor ? await getAutor() : "";

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
                if (entradas.length > 0 || info.paquete.error !== undefined) {
                    const logPath = await escribirLog(basedir, info, entradas, info.paquete.logs, info.paquete.error);
                    if (info.paquete.error !== undefined) {
                        avisos.push(`⚠  ${info.npmName}: error durante la actualización — ver ${logPath}`);
                    }
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
                if (entradas.length > 0 || info.paquete.error !== undefined) {
                    const logPath = await escribirLog(basedir, info, entradas, info.paquete.logs, info.paquete.error);
                    if (conflictos) {
                        avisos.push(`⚠  ${info.npmName}: merge con conflictos — ver ${logPath}`);
                        aConflictoUpdate.push(info);
                    } else if (info.paquete.error !== undefined) {
                        avisos.push(`⚠  ${info.npmName}: error durante la actualización — ver ${logPath}`);
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

    // ── Desinstalaciones ────────────────────────────────────────────────────────
    //
    // Paso 1: construir mapa inverso de dependencias entre frameworks instalados.
    //   dependantesOf[X] = Set de npmNames de frameworks instalados que dependen de X.
    const todosInstalados = infos.filter(i => i.instalado);
    const dependantesOf = new Map<string, Set<string>>();
    await Promise.all(todosInstalados.map(async info => {
        const raw = await readFileString(`${info.localDir}/package.json`).catch(() => "{}");
        let pkg: {devDependencies?: Record<string, string>} = {};
        try {
            pkg = JSON.parse(raw);
        } catch (err) {
            Log.error({type: Log.label_base, label: "framework"}, `Error parseando ${info.localDir}/package.json`, err);
        }
        for (const dep of Object.keys(pkg.devDependencies ?? {})) {
            if (!dep.startsWith("@mr/")) { continue; }
            if (!dependantesOf.has(dep)) { dependantesOf.set(dep, new Set()); }
            dependantesOf.get(dep)!.add(info.npmName);
        }
    }));

    // Paso 2: determinar iterativamente cuáles pueden desinstalarse.
    //   Un framework puede desinstalarse si TODOS los frameworks que dependen de él
    //   también se van a desinstalar. La iteración se repite hasta estabilidad porque
    //   bloquear un framework puede desbloquear o bloquear a otros en cadena.
    const puedeDesinstalar = new Set(aDesinstalar.map(i => i.npmName));
    let huboCambioBloqueo = true;
    while (huboCambioBloqueo) {
        huboCambioBloqueo = false;
        for (const npmName of [...puedeDesinstalar]) {
            const dependantes = dependantesOf.get(npmName) ?? new Set<string>();
            const bloqueadores = [...dependantes].filter(d => !puedeDesinstalar.has(d));
            if (bloqueadores.length > 0) {
                puedeDesinstalar.delete(npmName);
                huboCambioBloqueo = true;
                Log.info({type: Log.label_base, label: "framework"}, Colors.colorize([Colors.FgYellow, Colors.Bright],
                    `⚠  ${npmName} no desinstalado: sigue siendo necesario para: ${bloqueadores.join(", ")}`));
            }
        }
    }

    // Paso 3: para los frameworks que pasan la validación, limpiar devDependencies
    //   de los workspaces consumidores y luego eliminar los directorios.
    const realmDesinstalar = aDesinstalar.filter(i => puedeDesinstalar.has(i.npmName));
    if (realmDesinstalar.length > 0) {
        await limpiarDevDepsConsumidores(basedir, realmDesinstalar.map(i => i.npmName));
        await Promise.all(realmDesinstalar.map(async info => {
            await unlink(info.localDir);
            cambio = true;
            Log.info({type: Log.label_base, label: "framework"}, Colors.colorize([Colors.FgYellow], `Desinstalado ${info.npmName}`));
        }));
    }
    // ────────────────────────────────────────────────────────────────────────────

    // Resolver dependencias @mr/* de los frameworks instalados.
    // Se revisan TODOS los instalados (no solo los modificados en este run) para detectar
    // cualquier dep faltante antes de ejecutar yarn install: ya sea por un framework recién
    // actualizado que añadió una nueva dep, o por una dep que no se instaló en un run anterior
    // (p.ej. run interrumpido). add() solo descarga los que realmente falten en disco.
    const fwDepsArgs = new Set<string>();
    for (const info of infos.filter(i => i.instalado)) {
        for (const dep of await leerDepsMrFramework(info.localDir)) {
            fwDepsArgs.add(dep);
        }
    }
    if (fwDepsArgs.size > 0) {
        Log.info({type: Log.label_base, label: "framework"}, Colors.colorize([Colors.FgCyan, Colors.Bright], "Verificando dependencias de framework..."));
        if (await add(basedir, [...fwDepsArgs])) {
            cambio = true;
        }
    }

    // Reinstalar dependencias cuando hubo acciones que pueden tocar manifests/locks
    const necesitaInstall = aInstalar.length > 0 || realmDesinstalar.length > 0
        || aActualizar.length > 0 || aResetear.length > 0;
    let installHecho = false;
    if (necesitaInstall) {
        await install(basedir, {verbose: false});
        installHecho = true;
        await aplicarPatches(basedir);
    }

    // Recompilar CLI si fue modificado
    if (cliActualizado) {
        await recompilarCliente(basedir, await getClienteHash(basedir), {reiniciar, skipInstall: installHecho});
    }

    // Envíos directos en paralelo
    if (aEnviar.length > 0) {
        Paquete.setupConsolaParaUpdate(aEnviar.map(i => i.paquete));
        await Promise.all(aEnviar.map(async info => {
            await info.paquete.push(autor);
            cambio = true;
            await info.paquete.subirLogHtml().catch((err) => { Log.error({type: Log.label_base, label: "framework"}, "Error subiendo log HTML", err); });
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
            if (entradas.length > 0 || info.paquete.error !== undefined) {
                logPath = await escribirLog(basedir, info, entradas, info.paquete.logs, info.paquete.error);
            }

            if (info.paquete.error !== undefined) {
                avisos.push(`⚠  ${info.npmName}: error durante la actualización — no se ha enviado — ver ${logPath}`);
            } else if (!conflictos) {
                await info.paquete.push(autor);
                cambio = true;
                await info.paquete.subirLogHtml().catch((err) => { Log.error({type: Log.label_base, label: "framework"}, "Error subiendo log HTML", err); });
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
        Log.info({type: Log.label_base, label: "framework"}, Colors.colorize([Colors.FgYellow, Colors.Bright],
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
                await aplicarPatches(basedir);
                if (conflictoCli) {
                    await recompilarCliente(basedir, await getClienteHash(basedir), {reiniciar, skipInstall: true});
                }
            }
        }
    }

    for (const aviso of avisos) {
        Log.info({type: Log.label_base, label: "framework"}, Colors.colorize([Colors.FgYellow, Colors.Bright], aviso));
    }

    return cambio;
}

