export enum PubSubErrorStep {
    RECIBIDO,
    ACEPTADO,
    TERMINADO,
}

export enum PubSubErrorTipo {
    TIMEOUT,
    USER,
}

export class PubSubError extends Error {
    public constructor(public readonly step: PubSubErrorStep, public readonly tipo: PubSubErrorTipo, public readonly error?: any) {
        super("Error de PubSub");
    }
}
