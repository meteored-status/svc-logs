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

interface IMessageBounceEvent extends IMessageIDEvent {
    type: "bounce";
    rcpt_to: string;
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

interface IMessageOutOfBandEvent extends IMessageIDEvent {
    type: "out_of_band";
}

interface IMessagePolicyRejectionEvent extends IMessageIDEvent {
    type: "policy_rejection";
}

interface IMessageDelayEvent extends IMessageIDEvent {
    type: "delay";
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
