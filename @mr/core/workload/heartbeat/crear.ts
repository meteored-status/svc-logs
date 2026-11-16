/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: d6b5471aa389157bf85574da6b53c060
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import os from "node:os";

import {entornoActual} from "@mr/core-log/interface";
import {info, warning} from "services-comun/modules/utiles/log";
import {servicioDePod} from "@mr/core-log/pod";
import {WSPool} from "@mr/core-network/client/websocket";

import type {IPodInfo} from "../config/pod";
import {CABECERA_HEARTBEAT} from "./interface";
import {Heartbeat} from "./emisor";
import {InformanteWorker} from "./informante";
import {MedidorMetricas} from "./metricas";
import {RegistroWorkers} from "./workers";
import {Sonda} from "./sonda";
import {construirContexto} from "./payload";
import {decidirHeartbeat} from "./config";
import {resolverContexto} from "./contexto";
import {leerMetadatos} from "./metadatos";
import {registrarHeartbeat, type IInstanciaHeartbeat} from "./registro";

/**
 * Cómo corre el proceso.
 *
 * - `simple`   — un solo proceso por pod: emite él.
 * - `primario` — primario de un cluster: emite un heartbeat agregado con lo que le cuentan los workers.
 * - `worker`   — worker de un cluster: informa de su estado al primario por IPC.
 */
export type TModoHeartbeat = "simple"|"primario"|"worker";

/**
 * Configuración de {@link iniciarHeartbeat}.
 *
 * @property pod - Metadatos del pod.
 * @property unix - Epoch ms del arranque del proceso (el `unix` de `Main`).
 * @property modo - Cómo corre el proceso.
 */
export interface IConfigIniciarHeartbeat {
    pod: IPodInfo;
    unix: number;
    modo: TModoHeartbeat;
}

/**
 * Lo que devuelve {@link iniciarHeartbeat}.
 *
 * @property instancia - El emisor o el informante de este proceso.
 * @property workers - Registro de workers, solo en el primario de un cluster.
 * @property emisor - El emisor, solo si este proceso emite (pod simple o primario); `null` en un worker.
 */
export interface IHeartbeatCreado {
    instancia: IInstanciaHeartbeat;
    workers: RegistroWorkers|null;
    emisor: Heartbeat|null;
}

/**
 * Decide si este proceso emite heartbeat y, si es así, lo monta y lo arranca en estado `arrancando`. Lo llama
 * `Main` tras el sidecar; el engine HTTP lo encuentra después con `heartbeatActual()`.
 *
 * @returns Lo montado, o `null` si no aplica (no es un servicio de k8s, `HEARTBEAT` no es `true`, falta
 *   configuración…). Los avisos de configuración los da solo el proceso que no es worker.
 */
export function iniciarHeartbeat({pod, unix, modo}: IConfigIniciarHeartbeat): IHeartbeatCreado|null {
    const entorno = entornoActual();
    const decision = decidirHeartbeat({env: process.env, entorno, tipo: pod.tipo, target: pod.target});
    if (modo !== "worker") {
        for (const aviso of decision.avisos) {
            warning(aviso);
        }
    }
    if (!decision.habilitado) {
        if (decision.avisar && modo !== "worker") {
            warning(`Heartbeat desactivado: ${decision.motivo}`);
        }
        return null;
    }

    const sonda = new Sonda();
    if (modo === "worker") {
        const informante = new InformanteWorker({
            sonda,
            enviar: (mensaje) => { process.send?.(mensaje); },
        });
        informante.iniciar();
        registrarHeartbeat(informante);

        return {instancia: informante, workers: null, emisor: null};
    }

    const {socket, token} = decision.config;
    // En producción no se emite hasta tener cluster, proyecto y ubicación (son parte de la clave de la tabla del receptor):
    // `leerMetadatos` reintenta con backoff y no resuelve antes. Fuera de ella no se pregunta.
    const contexto = resolverContexto(
        leerMetadatos({env: process.env, consultar: PRODUCCION, reintentar: PRODUCCION}),
        (metadatos) => construirContexto({
            pod,
            entorno,
            env: process.env,
            servicio: servicioDePod(pod),
            hostname: os.hostname(),
            metadatos,
            inicio: unix,
            produccion: PRODUCCION,
            avisar: (mensaje) => { warning(mensaje); },
        }),
    );
    const workers = modo === "primario" ? new RegistroWorkers() : null;
    const medidor = new MedidorMetricas();
    const emisor = new Heartbeat({
        contexto,
        pool: WSPool.get({socket, headers: {[CABECERA_HEARTBEAT]: token}, minConnections: 1, heartbeatTimeoutMs: 25000}),
        sonda,
        fuente: workers !== null ? () => workers.agregar(Date.now()) : undefined,
        metricas: () => medidor.leer(),
    });
    info(`Heartbeat activado hacia ${socket}${modo === "primario" ? " (primario de un cluster)" : ""}`);
    emisor.iniciar();
    registrarHeartbeat(emisor);

    return {instancia: emisor, workers, emisor};
}
