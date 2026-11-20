/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: 2e67dae536a1797e010aecec6ef472ae
 * Versión: 2026.11.20+1-bixus
 * Anterior: 2026.11.18+1-bixus
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
import {RegistroWorkers, metricasConWorkers} from "./workers";
import {Sonda} from "./sonda";
import {cargaDePod, esCargaFinita} from "./carga";
import {construirContexto} from "./payload";
import {adaptarPool} from "./pool";
import {decidirHeartbeat} from "./config";
import {resolverContexto} from "./contexto";
import {leerMetadatos} from "./metadatos";
import {registrarHeartbeat, type IInstanciaHeartbeat} from "./registro";

/**
 * Tiempo máximo de cada petición `get()` del pool del heartbeat. Solo la despedida usa `get()`, con su propio tope (300 ms el
 * intento 1, el resto del presupuesto el reintento): el temporizador de `WSPool` no tiene `unref`, y con el valor por defecto (30 s)
 * cada petición abandonada dejaría un temporizador pendiente medio minuto.
 *
 * Ojo: esto **no acota la vida del proceso** con un `@mr/core-network` anterior: tras `destroy()` podían seguir vivos un socket con
 * un `addConnection` pendiente y el bucle de reconexión de `stream()`. En producción no importa porque todos los caminos de la
 * despedida acaban en un `process.exit` explícito. El arreglo de raíz está ya en `@mr/core-network` (`destroy()` cierra el
 * handshake que termina después, no abre más conexiones y `stream()` mira `destroyed`); este comentario sigue valiendo para quien
 * tenga un core-network sin esa versión.
 */
const REQUEST_TIMEOUT_MS = 1000;

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
 * @property timeoutSondaMs - Tiempo máximo de cada sondeo de `started()`/`ready()` (por defecto el de {@link Sonda}, 900 ms).
 */
export interface IConfigIniciarHeartbeat {
    pod: IPodInfo;
    unix: number;
    modo: TModoHeartbeat;
    timeoutSondaMs?: number;
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
 * `Main` al empezar `start()` (antes de cargar la configuración y de esperar al sidecar); el engine HTTP lo encuentra después con `heartbeatActual()`.
 *
 * @returns Lo montado, o `null` si no aplica (no es un servicio, cronjob o job de k8s, `HEARTBEAT` no es `true`, falta
 *   configuración…). Los avisos de configuración los da solo el proceso que no es worker.
 */
export function iniciarHeartbeat({pod, unix, modo, timeoutSondaMs}: IConfigIniciarHeartbeat): IHeartbeatCreado|null {
    const entorno = entornoActual();
    const decision = decidirHeartbeat({env: process.env, entorno, tipo: pod.tipo, target: pod.target, modo});
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

    const carga = cargaDePod(pod.tipo);
    const finita = esCargaFinita(carga);
    const sonda = new Sonda({timeoutMs: timeoutSondaMs, finita});
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
            carga,
            avisar: (mensaje) => { warning(mensaje); },
        }),
    );
    const workers = modo === "primario" ? new RegistroWorkers() : null;
    const medidor = new MedidorMetricas();
    const emisor = new Heartbeat({
        contexto,
        pool: adaptarPool(WSPool.get({socket, headers: {[CABECERA_HEARTBEAT]: token}, minConnections: 1, heartbeatTimeoutMs: 25000, requestTimeoutMs: REQUEST_TIMEOUT_MS})),
        // Sin `-reconnect` en la clave del singleton: es otro pool, con su propia conexión, que no reconecta por su cuenta.
        abrirNuevo: () => adaptarPool(WSPool.get({socket, headers: {[CABECERA_HEARTBEAT]: token}, minConnections: 1, heartbeatTimeoutMs: 25000, requestTimeoutMs: REQUEST_TIMEOUT_MS, reconnect: false})),
        sonda,
        finita,
        fuente: workers !== null ? () => workers.agregar(Date.now()) : undefined,
        metricas: () => metricasConWorkers(medidor.leer(), workers, Date.now()),
    });
    info(`Heartbeat activado hacia ${socket}${modo === "primario" ? " (primario de un cluster)" : ""}${finita ? ` (${carga})` : ""}`);
    emisor.iniciar();
    registrarHeartbeat(emisor);

    return {instancia: emisor, workers, emisor};
}
