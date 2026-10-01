/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: fef5bd869bc90a3b54f4e40a15909320
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Send} from "../data/model/send";

export type OKHandler<T> = (result: T) => void;
export type KOHandler = () => void;

export abstract class Sender<T = any> {
    /* INSTANCE */
    protected okHandler: OKHandler<T> | null;
    protected koHandler: KOHandler | null;

    protected constructor(private readonly _send: Send) {
        this.okHandler = null;
        this.koHandler = null;
    }

    public set onOK(handler: (result: T) => void) {
        this.okHandler = handler;
    }

    public set onKO(handler: () => void) {
        this.koHandler = handler;
    }

    protected get send(): Send {
        return this._send;
    }

    public abstract run(): Promise<T>;
}
