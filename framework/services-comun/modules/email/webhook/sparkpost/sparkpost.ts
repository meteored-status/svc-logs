/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 03 Sep 2026 13:36:43 GMT
 * Hash: 7228a44531696a0c1af52d26f9f9066a
 * Versión: 2026.9.3+3-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-newsletter.git
 */

export type TEvent = "message_event" | "track_event" | "gen_event" | "unsubscribe_event" | "relay_event" | "ab_test_event" | "ingest_event";
export type TMessageEvent =
    "bounce"
    | "delivery"
    | "injection"
    | "sms_status"
    | "spam_complaint"
    | "out_of_band"
    | "policy_rejection"
    | "delay";
export type TTrackEvent = "click" | "open" | "initial_open" | "amp_click" | "amp_open" | "amp_initial_open";
export type TGenEvent = "generation_failure" | "generation_rejection";
export type TUnsubscribeEvent = "list_unsubscribe" | "link_unsubscribe" ;

export interface IEvent {
    timestamp: string;
    type: TMessageEvent|TTrackEvent|TGenEvent|TUnsubscribeEvent;
}

/** MESSAGE EVENTS */
interface IMessageEvent extends IEvent {
    transmission_id: string;
    type: TMessageEvent;
}

export interface IMessageIDEvent extends IMessageEvent {
    message_id: string;
    rcpt_to: string;
}

/**
 * Evento de rebote. Cubre los dos sabores, que comparten forma:
 *
 * - `bounce`      — el rechazo llega durante el envío, antes de que nadie acepte el mensaje.
 * - `out_of_band` — el rechazo llega **después** de que el MTA remoto aceptase el mensaje, así que
 *                   para entonces ya se emitió un `delivery` por él.
 *
 * Los campos van opcionales porque el proveedor no garantiza ninguno; `bounce_class` en particular
 * viaja como **cadena** (`"25"`), no como número — ver `claseRebote()` en `./bounce-class`.
 *
 * @property bounce_class - Clase de rebote de la taxonomía de Sparkpost.
 * @property error_code   - Código SMTP devuelto por el receptor.
 * @property raw_reason   - Motivo tal cual lo devolvió el receptor, sin normalizar.
 * @property reason       - Motivo normalizado por Sparkpost.
 */
export interface IMessageBounceEvent extends IMessageIDEvent {
    type: "bounce"|"out_of_band";
    bounce_class?: string;
    error_code?: string;
    raw_reason?: string;
    reason?: string;
}

interface IMessageDeliveryEvent extends IMessageIDEvent {
    type: "delivery";
}

interface IMessageInjectionEvent extends IMessageIDEvent {
    type: "injection";
}

interface IMessageSMSStatusEvent extends IMessageEvent {
    type: "sms_status";
}

interface IMessageSpamCompliantEvent extends IMessageIDEvent {
    type: "spam_complaint";
}

interface IMessagePolicyRejectionEvent extends IMessageIDEvent {
    type: "policy_rejection";
}

interface IMessageDelayEvent extends IMessageIDEvent {
    type: "delay";
}



/**
 * Discrimina los eventos que traen información de rebote dentro del payload genérico.
 *
 * @param evento - Payload del evento, sin discriminar.
 * @returns `true` si el evento es un rebote, síncrono o asíncrono.
 */
export function esRebote(evento: IEvent): evento is IMessageBounceEvent {
    return evento.type === "bounce" || evento.type === "out_of_band";
}

/** TRACK EVENTS */

export interface ITrackEvent extends IEvent {
    transmission_id: string;
    type: TTrackEvent;
    rcpt_to: string;
}



/** GEN EVENTS */

interface IGenEvent extends IEvent {
    transmission_id: string;
    type: TGenEvent;
    rcpt_to: string;
}



/** UNSUBSCRIBE EVENTS */

export interface IUnsubscribeEvent extends IEvent {
    transmission_id: string;
    type: TUnsubscribeEvent;
    rcpt_to: string;
}



/** RELAY EVENTS */
interface IRelayEvent extends IEvent {

}



/** AB TEST EVENTS */
interface IABTestEvent extends IEvent {

}



/** INGEST EVENTS */
interface IIngestEvent extends IEvent {

}

export interface IMSYS {
    message_event?: IMessageEvent;
    track_event?: ITrackEvent;
    gen_event?: IGenEvent;
    unsubscribe_event?: IUnsubscribeEvent;
    relay_event?: IRelayEvent;
    ab_test_event?: IABTestEvent;
    ingest_event?: IIngestEvent;
}

interface IResult {
    msys: IMSYS;
}

export interface IBatch {
    [k: number]: IResult;
}
