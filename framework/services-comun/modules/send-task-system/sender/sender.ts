import {Send} from "../data/model/send";

export type OKHandler<T> = (result: T) => void;
export type KOHandler = () => void;

export abstract class Sender<T=any> {
    /* STATIC */

    /* INSTANCE */
    protected okHandler: OKHandler<T>|null = null;
    protected koHandler: KOHandler|null = null;
    protected constructor(private readonly _send: Send) {
    }

    protected get send(): Send {
        return this._send;
    }

    public set onOK(handler: (result: T) => void) {
        this.okHandler = handler;
    }

    public set onKO(handler: () => void) {
        this.koHandler = handler;
    }

    public abstract run(): Promise<T>;
}
