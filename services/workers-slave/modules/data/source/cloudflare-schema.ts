import {z} from "zod";

/**
 * Valores de `EventType` del dataset «Workers Trace Events» de Logpush.
 *
 * Los siete primeros son los que documenta Cloudflare; `tail` no está documentado, pero ya lo
 * aceptaba el esquema anterior y se mantiene para no perder eventos que pudieran estar llegando.
 */
export const EVENT_TYPES = ["fetch", "alarm", "scheduled", "queue", "email", "worker_rpc", "hibernatable_web_socket", "tail"] as const;

/** Los de `EVENT_TYPES` cuyo `Event` no tiene forma conocida y se guarda como texto en `event.detail`. */
const EVENT_TYPES_SIN_FORMA = ["scheduled", "queue", "email", "worker_rpc", "hibernatable_web_socket", "tail"] as const satisfies readonly TEventType[];

/**
 * Valores de `Outcome`: los cuatro de Logpush (`ok`, `canceled`, `exception`, `unknown`) más los
 * que la Tail API documenta para el mismo concepto.
 */
export const OUTCOMES = ["ok", "canceled", "exception", "unknown", "exceededCpu", "exceededMemory", "scriptNotFound", "responseStreamDisconnected"] as const;

export type TEventType = typeof EVENT_TYPES[number];
export type TOutcome = typeof OUTCOMES[number];

/**
 * Documento que se indexa en `logs-worker-<cliente>`, sin el `source` (lo añade quien parsea).
 *
 * @property @timestamp - `EventTimestampMs`.
 * @property entrypoint - Clase de entrada (p. ej. el Durable Object); ausente si viene vacía.
 * @property status     - `Outcome`.
 * @property script     - `ScriptName`.
 * @property event      - Tipo y detalle del evento que disparó la invocación.
 * @property exceptions - Excepciones no capturadas; ausente si no hay.
 * @property logs       - Cada mensaje de consola serializado a JSON; ausente si no hay.
 * @property tags       - `ScriptTags`; ausente si no hay.
 * @property version    - `ScriptVersion`.
 * @property namespace  - `DispatchNamespace`; ausente si viene vacío.
 */
export interface IRegistroCloudflare {
    "@timestamp": Date;
    entrypoint?:  string;
    status:       TOutcome;
    script:       string;
    event:        IEvent;
    exceptions?:  IException[];
    logs?:        string[];
    tags?:        string[];
    version:      IScriptVersion;
    namespace?:   string;
}

/**
 * Evento que disparó la invocación. Qué campos lleva depende de `type`.
 *
 * @property type          - `EventType`.
 * @property rayID         - Solo `fetch`.
 * @property request       - Solo `fetch`.
 * @property response      - Solo `fetch`.
 * @property scheduledTime - Solo `alarm`: hora a la que estaba programada la alarma.
 * @property detail        - Resto de tipos: el `Event` original serializado a JSON, porque
 *                           Cloudflare no documenta su forma y no se ha visto ninguno en producción.
 *                           Va como texto para no abrir campos nuevos en el mapping dinámico.
 */
export interface IEvent {
    type:           TEventType;
    rayID?:         string;
    request?:       IRequest;
    response?:      IResponse;
    scheduledTime?: Date;
    detail?:        string;
}

interface IRequest {
    url:    string;
    method: string;
}

interface IResponse {
    status: number;
}

interface IException {
    name:      string;
    message:   string;
    timestamp: Date;
}

interface IScriptVersion {
    id:       string;
    message?: string;
    tag?:     string;
}

/**
 * Resultado de parsear una línea: el registro, o el motivo por el que se descarta.
 *
 * El motivo es corto y estable (no lleva el evento entero) para poder agrupar por él.
 */
export type TParseo = {ok: true; registro: IRegistroCloudflare} | {ok: false; motivo: string};

function hacerUndefinedLength<T extends {length: number}>(v: T): T|undefined {
    return v.length>0?v:undefined;
}

const SCHEMA_EVENT_FETCH = z.object({
    RayID:    z.string(),
    Request:  z.object({
        URL:    z.string(),
        Method: z.string(),
    }).strict(),
    Response: z.object({
        Status: z.number(),
    }).strict(),
}).strict();

const SCHEMA_EVENT_ALARM = z.object({
    ScheduledTimeMs: z.coerce.date(),
}).strict();

const SCHEMA_EVENT_OTRO = z.record(z.string(), z.unknown()).nullable().optional();

const SCHEMA_EXCEPTIONS = z.object({
    Name:        z.string(),
    Message:     z.string(),
    TimestampMs: z.coerce.date(),
}).strict().transform(o=>({
    name: o.Name,
    message: o.Message,
    timestamp: o.TimestampMs,
})).array().transform(hacerUndefinedLength).optional();

const SCHEMA_VERSION = z.object({
    ID:      z.string(),
    Message: z.string().transform(hacerUndefinedLength).optional(),
    Tag:     z.string().transform(hacerUndefinedLength).optional(),
}).strict().transform(o=>({
    id: o.ID,
    message: o.Message,
    tag: o.Tag,
}));

const SCHEMA_BASE = z.object({
    Entrypoint:        z.string().transform(hacerUndefinedLength).optional(),
    EventTimestampMs:  z.coerce.date(),
    Exceptions:        SCHEMA_EXCEPTIONS,
    Logs:              z.any().array().transform(lineas=>lineas.map(linea=>JSON.stringify(linea))).transform(hacerUndefinedLength).optional(),
    Outcome:           z.enum(OUTCOMES),
    ScriptName:        z.string(),
    ScriptTags:        z.string().array().transform(hacerUndefinedLength).optional(),
    ScriptVersion:     SCHEMA_VERSION,
    DispatchNamespace: z.string().transform(hacerUndefinedLength).optional(),
}).strict();

const SCHEMA = z.discriminatedUnion("EventType", [
    SCHEMA_BASE.extend({
        EventType: z.literal("fetch"),
        Event:     SCHEMA_EVENT_FETCH,
    }),
    SCHEMA_BASE.extend({
        EventType: z.literal("alarm"),
        Event:     SCHEMA_EVENT_ALARM,
    }),
    SCHEMA_BASE.extend({
        EventType: z.enum(EVENT_TYPES_SIN_FORMA),
        Event:     SCHEMA_EVENT_OTRO,
    }),
]).transform((o): IRegistroCloudflare=>{
    let event: IEvent;
    switch (o.EventType) {
        case "fetch":
            event = {
                type: o.EventType,
                rayID: o.Event.RayID,
                request: {url: o.Event.Request.URL, method: o.Event.Request.Method},
                response: {status: o.Event.Response.Status},
            };
            break;
        case "alarm":
            event = {
                type: o.EventType,
                scheduledTime: o.Event.ScheduledTimeMs,
            };
            break;
        default:
            event = {
                type: o.EventType,
                detail: o.Event!=null && Object.keys(o.Event).length>0 ? JSON.stringify(o.Event) : undefined,
            };
            break;
    }

    return {
        "@timestamp": o.EventTimestampMs,
        entrypoint: o.Entrypoint,
        status: o.Outcome,
        script: o.ScriptName,
        event,
        exceptions: o.Exceptions,
        logs: o.Logs,
        tags: o.ScriptTags,
        version: o.ScriptVersion,
        namespace: o.DispatchNamespace,
    };
});

function valorEn(raiz: unknown, ruta: PropertyKey[]): unknown {
    let actual = raiz;
    for (const clave of ruta) {
        if (actual==null || typeof actual!=="object") {
            return undefined;
        }
        actual = (actual as Record<PropertyKey, unknown>)[clave];
    }
    return actual;
}

/**
 * Resume los fallos de Zod en un texto corto y estable: una entrada por problema, ordenadas.
 *
 * Para los valores primitivos incluye el valor recibido (`EventType="foo"`), que es justo lo que
 * hace falta para saber qué tipo o resultado nuevo ha empezado a mandar Cloudflare; para las claves
 * sobrantes, sus nombres.
 *
 * @param error - Error de Zod.
 * @param json - Objeto que se intentó validar.
 * @returns Motivo agrupable.
 */
function motivo(error: z.ZodError, json: unknown): string {
    const partes = new Set<string>();
    for (const issue of error.issues) {
        const ruta = issue.path.map(String).join(".") || "(raíz)";
        if (issue.code==="unrecognized_keys") {
            partes.add(`${ruta}: claves no reconocidas ${issue.keys.join(",")}`);
            continue;
        }
        const valor = valorEn(json, issue.path);
        if (typeof valor==="string" || typeof valor==="number" || typeof valor==="boolean") {
            partes.add(`${ruta}=${JSON.stringify(valor)}`);
        } else {
            partes.add(`${ruta}: ${issue.code}`);
        }
    }
    return [...partes].sort().join("; ");
}

/**
 * Parsea una línea NDJSON de Workers Trace Events.
 *
 * Nunca lanza: una línea que no se reconoce devuelve el motivo, para que quien llama los agrupe y
 * los registre de forma acotada en vez de escribir un error por línea.
 *
 * @param linea - Línea del fichero, ya sin espacios alrededor.
 * @returns Registro listo para indexar, o el motivo del descarte.
 */
export function parsearLinea(linea: string): TParseo {
    let json: unknown;
    try {
        json = JSON.parse(linea);
    } catch {
        return {ok: false, motivo: "JSON inválido"};
    }

    const resultado = SCHEMA.safeParse(json);
    if (!resultado.success) {
        return {ok: false, motivo: motivo(resultado.error, json)};
    }

    return {ok: true, registro: resultado.data};
}
