import {Send} from "../data/model/send";

export abstract class ReceiverIdentifier {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly _send: Send) {
    }

    protected get send(): Send {
        return this._send;
    }

    public abstract identify(): string[];
}
