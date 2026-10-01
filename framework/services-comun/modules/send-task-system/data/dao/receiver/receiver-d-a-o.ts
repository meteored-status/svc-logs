/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 6ff412fef1c6b3903836a8b64a3f8bde
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Receiver} from "../../model/receiver";
import type {Bulk, BulkConfig} from "../../../../database/bulk";
import type {Scroll} from "../../../../database/scroll";

interface IReceiverDAO {
    save(receiver: Receiver): Promise<Receiver>;

    getBySendIds(sendIds: string[], scroll?: Scroll<any>): Promise<Receiver[]>;

    createBulk(config?: BulkConfig): Promise<Bulk>;

    createScroll(): Promise<Scroll<any>>;
}

export abstract class ReceiverDAO implements IReceiverDAO {
    /* INSTANCE */
    public abstract save(receiver: Receiver): Promise<Receiver>;

    public abstract getBySendIds(sendIds: string[], scroll?: Scroll<any>): Promise<Receiver[]>;

    public abstract createBulk(config?: BulkConfig): Promise<Bulk>;

    public abstract createScroll(): Promise<Scroll<any>>;
}
