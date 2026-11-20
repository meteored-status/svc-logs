/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: ec074c3854de923638b45a018423b189
 * Versión: 2026.11.20+1-bixus
 * Anterior: 2026.11.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EEntorno} from "@mr/core-log/interface";

/**
 * Contrato del heartbeat de pods. **Solo tipos y constantes, sin imports de Node**: es la única declaración
 * del mensaje, como `IWire` en `@mr/core-log`, y `status-external` (el receptor) la importa de aquí y no al
 * revés.
 */

/** Ruta del upgrade WebSocket del receptor. Es lo que mira el VirtualService de Istio para encaminarlo. */
export const RUTA_HEARTBEAT = "/status/external/heartbeat/";

/** Método WebSocket que atiende el heartbeat en el receptor (se envía con `head()`, sin respuesta). */
export const METODO_HEARTBEAT = "heartbeat";

/**
 * Método WebSocket que atiende el receptor para la **despedida** (`parado`): lleva el mismo {@link IHeartbeat} que
 * {@link METODO_HEARTBEAT}, en la misma ruta y con la misma autorización, pero **sí contesta** con una
 * {@link IConfirmacionHeartbeat}. Lo manda con `get()` solo la despedida; un receptor que no lo conoce responde de inmediato
 * `ok: false` («No handler for method»), y el emisor recurre entonces a {@link METODO_HEARTBEAT}.
 */
export const METODO_HEARTBEAT_CONFIRMADO = "heartbeat-confirmado";

/** Cabecera del handshake con el token con el que el receptor autoriza la conexión. */
export const CABECERA_HEARTBEAT = "x-mr-heartbeat";

/**
 * Estado de un pod.
 *
 * - `arrancando` — el engine aún no existe o su `started()` todavía no ha resuelto.
 * - `listo`      — lo mismo que respondería `/admin/ready/` con 200.
 * - `no-listo`   — `/admin/ready/` no respondería 200.
 * - `drenando`   — el pod se está apagando; ver {@link TCausaDrenado}.
 * - `parado`     — despedida: el proceso sale justo después.
 */
export type TEstadoPod = "arrancando"|"listo"|"no-listo"|"drenando"|"parado";

/**
 * Por qué un pod está `drenando`.
 *
 * - `senal`   — Node recibió `SIGTERM`/`SIGINT` (o el servidor ya estaba cerrando).
 * - `prestop` — apareció `shutdown.lock`, que escribe el hook preStop del kustomize.
 *
 * Si se dan las dos, manda `senal`: es la que demuestra que la señal llega de verdad a Node.
 */
export type TCausaDrenado = "senal"|"prestop";

/**
 * Procesos de un pod en modo cluster.
 *
 * @property total - Procesos worker vivos.
 * @property listos - Los que están `listo` y han informado hace menos de 3 s.
 */
export interface IHeartbeatProcesos {
    total: number;
    listos: number;
}

/**
 * Medidas del proceso en el momento del envío.
 *
 * @property rss - Memoria residente (bytes). En un pod simple es la del proceso; en el primario de un cluster, la suma de la del
 *   primario y la de los workers vivos que han informado hace menos de 3 s.
 * @property loopP99 - Percentil 99 del retraso del event loop (ms) desde el envío anterior.
 * @property loopMax - Máximo del retraso del event loop (ms) desde el envío anterior.
 * @property uptime - Segundos desde el arranque del proceso.
 */
export interface IHeartbeatMetricas {
    rss: number;
    loopP99: number;
    loopMax: number;
    uptime: number;
}

/**
 * Carga de trabajo del pod, la que decide el tipo del manifest (`pod.tipo`), nunca la programación.
 *
 * - `service` — un servicio (Deployment). Es lo que se entiende cuando el campo `carga` no llega.
 * - `cronjob` — un pod de un CronJob.
 * - `job`     — un pod de un job (desplegado como CronJob con una programación imposible y lanzado a mano).
 *
 * En una carga finita (`cronjob` y `job`) el estado `listo` significa «en curso» y la ejecución termina en `parado`.
 */
export type TCargaPod = "service"|"cronjob"|"job";

/** Resultado de una ejecución, tal y como lo declara el pod al despedirse. */
export type TResultadoEjecucion = "ok"|"error";

/** `concurrencyPolicy` del CronJob. */
export type TConcurrenciaCron = "Allow"|"Forbid"|"Replace";

/**
 * Lo que un pod de una carga finita cuenta de su ejecución. Una ejecución es un Job de Kubernetes, no un pod: con `backoffLimit`
 * un intento que muere lo reintenta Kubernetes con otro pod **del mismo Job** (misma pareja `job` + `jobUid`).
 *
 * @property job - Nombre del Job (etiqueta `job-name`). No vacío; como mucho 63 caracteres.
 * @property jobUid - UID del Job (`controller-uid`); como mucho 36 caracteres. `''` si el emisor no lo sabe.
 * @property cronjob - Nombre del CronJob (`CRON_NOMBRE`, o deducido del nombre del Job). No vacío; como mucho 63 caracteres.
 * @property indice - Índice del pod en un Job `Indexed` (`JOB_COMPLETION_INDEX`, que inyecta Kubernetes): entero de 0 a 65535. `null` si el Job no es
 *   Indexed o el valor no es válido. **Opcional en el contrato**: un emisor anterior no lo manda y el receptor lo toma por `null`.
 * @property programada - Epoch ms de la hora programada (la que Kubernetes pone en el nombre del Job), o `null` si no la hay: en un
 *   `job`, siempre; en una ejecución manual de un cronjob (`kubectl create job --from=cronjob/...`), normalmente.
 * @property programacion - `spec.schedule` tal y como se desplegó (como mucho 100 caracteres), o `null` si el pod no la trae.
 * @property zonaHoraria - `spec.timeZone` (como mucho 64 caracteres); `null` es UTC o que el pod no lo trae.
 * @property concurrencia - `concurrencyPolicy`, o `null` si el pod no la trae.
 * @property plazoInicioS - `startingDeadlineSeconds` (entero >= 0), o `null`.
 * @property plazoEjecucionS - `activeDeadlineSeconds` (entero >= 0), o `null`.
 * @property resultado - Solo en la despedida (`parado`): `ok` o `error`. `null` mientras la ejecución sigue o si el pod no llegó a
 *   saber cómo acabó.
 * @property error - Solo con `resultado` `error`: `err.name` (nunca el mensaje), como mucho 64 caracteres (el receptor recorta); `null` si no.
 */
export interface IHeartbeatEjecucion {
    job: string;
    jobUid: string;
    cronjob: string;
    indice?: number|null;
    programada: number|null;
    programacion: string|null;
    zonaHoraria: string|null;
    concurrencia: TConcurrenciaCron|null;
    plazoInicioS: number|null;
    plazoEjecucionS: number|null;
    resultado: TResultadoEjecucion|null;
    error: string|null;
}

/**
 * Heartbeat de un pod, versión 1. Se envía por WebSocket cada segundo y sin esperar respuesta.
 *
 * @property v - Versión del contrato.
 * @property entorno - Entorno del bundle (`entornoActual()`).
 * @property proyectoGcp - Proyecto de GCP (servidor de metadatos de GKE o `HEARTBEAT_PROYECTO`); vacío si no se pudo leer.
 * @property cluster - Clúster de GKE (metadatos o `HEARTBEAT_CLUSTER`); vacío si no se pudo leer.
 * @property ubicacion - Ubicación del clúster (metadatos o `HEARTBEAT_UBICACION`); vacía si no se pudo leer.
 * @property zona - Zona de despliegue (`pod.zona`).
 * @property namespace - Namespace de Kubernetes (`K8S_NAMESPACE`); vacío fuera del clúster.
 * @property pod - Nombre del pod: `os.hostname()` en producción y `<hostname>/<servicio>` fuera de ella.
 * @property servicio - Nombre con el que se firma el servicio (`servicioDePod`), `<namespace>/<servicio>` en el clúster.
 * @property producto - Producto (`POD_PRODUCTO`, etiqueta `producto`); puede estar vacío.
 * @property departamento - Departamento (`POD_DPTO`, etiqueta `dpto`); puede estar vacío.
 * @property version - Versión del servicio.
 * @property revision - Revisión del despliegue: el `pod-template-hash` del ReplicaSet (`POD_REVISION`, etiqueta que pone Kubernetes),
 *   o el penúltimo trozo del hostname si no llega. Cambia en cada rollout, también en los que no traen imagen nueva y por tanto no
 *   cambian `version` (un cambio del yml); vacía fuera del clúster.
 * @property inicio - Epoch ms del arranque del proceso (el `unix` de `Main`).
 * @property seq - Crece en cada heartbeat construido; un hueco indica heartbeats descartados.
 * @property ts - Epoch ms del envío.
 * @property estado - Estado actual.
 * @property anterior - Estado anterior, o `null` si aún no ha habido ninguna transición.
 * @property desde - Epoch ms de la última transición.
 * @property tseq - Cuenta las transiciones de estado.
 * @property causaDrenado - Solo con `estado` `drenando` (y se conserva en `parado`); `null` en el resto.
 * @property procesos - Solo en modo cluster: el agregado de los workers.
 * @property metricas - Medidas del proceso.
 * @property carga - Carga del pod ({@link TCargaPod}). Ausente es `service`: un emisor anterior no lo manda y su comportamiento no cambia.
 * @property ejecucion - Solo con `carga` `cronjob` o `job` (con `service` se ignora): la ejecución a la que pertenece el pod.
 */
export interface IHeartbeat {
    v: 1;
    entorno: EEntorno;
    proyectoGcp: string;
    cluster: string;
    ubicacion: string;
    zona: string;
    namespace: string;
    pod: string;
    servicio: string;
    producto: string;
    departamento: string;
    version: string;
    revision: string;
    inicio: number;
    seq: number;
    ts: number;
    estado: TEstadoPod;
    anterior: TEstadoPod|null;
    desde: number;
    tseq: number;
    causaDrenado: TCausaDrenado|null;
    procesos?: IHeartbeatProcesos;
    metricas: IHeartbeatMetricas;
    carga?: TCargaPod;
    ejecucion?: IHeartbeatEjecucion;
}

/**
 * Respuesta de {@link METODO_HEARTBEAT_CONFIRMADO}. El acuse es **en memoria**: el receptor tiene el latido, no que ya esté en
 * MySQL o Elastic.
 *
 * - `confirmado` — el receptor lo tiene y sigue vivo para volcarlo.
 * - `reintentar` — el receptor lo ha tomado pero se está apagando, o no ha podido guardarlo (acumulador lleno): conviene
 *   mandarlo a otra réplica, con una conexión nueva. Repetir el mismo latido es inocuo (el receptor ignora un `seq` ya visto).
 *
 * @property v - Versión del contrato.
 * @property resultado - Lo que el emisor debe hacer.
 */
export interface IConfirmacionHeartbeat {
    v: 1;
    resultado: "confirmado"|"reintentar";
}
