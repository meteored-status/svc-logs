/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 80a310bceb639635209731818ab8fb4a
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EEntorno} from "@mr/core-log/interface";

import type {IHeartbeat, IHeartbeatMetricas, IHeartbeatProcesos, TCausaDrenado, TEstadoPod} from "./interface";
import type {IMetadatosPod} from "./metadatos";

/**
 * Lo que no cambia en la vida del proceso y va en cada heartbeat.
 */
export type IContextoHeartbeat = Omit<IHeartbeat, "v"|"seq"|"ts"|"estado"|"anterior"|"desde"|"tseq"|"causaDrenado"|"procesos"|"metricas">;

/**
 * Lo que cambia en cada envío.
 *
 * @property seq - Número de envío.
 * @property ts - Epoch ms del envío.
 * @property estado - Estado actual.
 * @property anterior - Estado anterior.
 * @property desde - Epoch ms de la última transición.
 * @property tseq - Transiciones hasta ahora.
 * @property causaDrenado - Causa del drenado.
 * @property procesos - Agregado de los workers, en cluster.
 * @property metricas - Medidas del proceso.
 */
export interface IFotoHeartbeat {
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

/**
 * Pod del que se saca el contexto.
 *
 * @property servicio - Nombre del servicio en el pod (`pod.servicio`).
 * @property zona - Zona de despliegue.
 * @property version - Versión.
 */
export interface IPodContexto {
    servicio: string;
    zona: string;
    version: string;
}

/**
 * Configuración de {@link construirContexto}.
 *
 * @property pod - Metadatos del pod.
 * @property entorno - Entorno del bundle.
 * @property env - Variables de entorno (`K8S_NAMESPACE`, `POD_DPTO`, `POD_PRODUCTO`, `POD_REVISION`).
 * @property servicio - Nombre con el que se firma el servicio (`servicioDePod(pod)`).
 * @property hostname - `os.hostname()`.
 * @property metadatos - Cluster, proyecto y ubicación.
 * @property inicio - Epoch ms del arranque del proceso.
 * @property avisar - Cómo dejar un aviso (se llama como mucho una vez por contexto, que se construye una sola vez por pod).
 */
export interface IConfigContexto {
    pod: IPodContexto;
    entorno: EEntorno;
    env: Record<string, string|undefined>;
    servicio: string;
    hostname: string;
    metadatos: IMetadatosPod;
    inicio: number;
    produccion: boolean;
    avisar?: (mensaje: string) => void;
}

/**
 * Lo que admite el receptor como `revision` (`LONGITUD_MAX.revision` de `status-external`, 16): con más, descarta **todos** los
 * latidos del pod y el pod no aparece. El `pod-template-hash` real son de 5 a 10.
 */
const FORMATO_REVISION_ENVIADA = /^[a-z0-9]{1,16}$/;

/** `pod-template-hash` de un Deployment: de 5 a 10 caracteres alfanuméricos en minúscula. */
const FORMATO_HASH_REVISION = /^[a-z0-9]{5,10}$/;

/** Sufijo aleatorio que Kubernetes añade al nombre de un pod de un ReplicaSet: 5 caracteres. */
const FORMATO_SUFIJO_POD = /^[a-z0-9]{5}$/;

/**
 * Configuración de {@link revisionDePod}.
 *
 * @property env - Variables de entorno (`POD_REVISION`).
 * @property hostname - `os.hostname()`.
 * @property produccion - Si corre en producción (en el clúster).
 * @property avisar - Cómo avisar de un `POD_REVISION` que no encaja con lo que acepta el receptor.
 */
export interface IConfigRevision {
    env: Record<string, string|undefined>;
    hostname: string;
    produccion: boolean;
    avisar?: (mensaje: string) => void;
}

/**
 * Revisión del despliegue: el `pod-template-hash` del ReplicaSet, que cambia en cada rollout aunque la imagen sea la
 * misma (un cambio solo del yml también cambia la plantilla del pod).
 *
 * 1. `POD_REVISION`, si llega (la Downward API la toma de la etiqueta `pod-template-hash`).
 * 2. En producción, y solo si el hostname tiene la forma `<deployment>-<hash>-<sufijo>`, su penúltimo trozo.
 * 3. Si no, cadena vacía (también fuera del clúster).
 *
 * Si `POD_REVISION` no encaja con `^[a-z0-9]{1,16}$` (el receptor descartaría todos los latidos), se manda vacía y se avisa, sin el valor.
 */
export function revisionDePod({env, hostname, produccion, avisar}: IConfigRevision): string {
    const declarada = (env["POD_REVISION"] ?? "").trim();
    if (declarada.length > 0) {
        if (FORMATO_REVISION_ENVIADA.test(declarada)) {
            return declarada;
        }
        avisar?.(`Heartbeat: POD_REVISION no encaja con ^[a-z0-9]{1,16}$ (${declarada.length} caracteres); se manda vacía para que el receptor no descarte los latidos`);

        return "";
    }
    if (!produccion) {
        return "";
    }

    const partes = hostname.split("-");
    if (partes.length < 3) {
        return "";
    }
    const hash = partes[partes.length - 2] as string;
    const sufijo = partes[partes.length - 1] as string;

    return FORMATO_HASH_REVISION.test(hash) && FORMATO_SUFIJO_POD.test(sufijo) ? hash : "";
}

/**
 * Compone el contexto fijo del heartbeat. El nombre del pod es `os.hostname()` en producción y
 * `<hostname>/<servicio>` fuera, porque fuera `pod.host` vale el nombre del servicio y varios servicios de
 * la misma máquina darían el mismo.
 */
export function construirContexto({pod, entorno, env, servicio, hostname, metadatos, inicio, produccion, avisar}: IConfigContexto): IContextoHeartbeat {
    return {
        entorno,
        proyectoGcp: metadatos.proyecto.valor,
        cluster: metadatos.cluster.valor,
        ubicacion: metadatos.ubicacion.valor,
        zona: pod.zona,
        namespace: env["K8S_NAMESPACE"] ?? "",
        pod: produccion ? hostname : `${hostname}/${pod.servicio}`,
        servicio,
        producto: env["POD_PRODUCTO"] ?? "",
        departamento: env["POD_DPTO"] ?? "",
        version: pod.version,
        revision: revisionDePod({env, hostname, produccion, avisar}),
        inicio,
    };
}

/**
 * Junta el contexto y la foto de un instante en el mensaje que se envía. Pura.
 */
export function construirHeartbeat(contexto: IContextoHeartbeat, foto: IFotoHeartbeat): IHeartbeat {
    const {procesos, ...resto} = foto;

    return {
        v: 1,
        ...contexto,
        ...resto,
        ...(procesos !== undefined ? {procesos} : {}),
    };
}
