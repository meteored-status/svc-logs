/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: aeaa9b918c1e572c3a6bad27bfd658cd
 * Versión: 2026.11.13+1-bixus
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
 * @property rss - Memoria residente (bytes).
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
}
