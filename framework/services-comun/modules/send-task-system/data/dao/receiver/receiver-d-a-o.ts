import {Receiver} from "../../model/receiver";
import {Bulk, BulkConfig} from "../../../../database/bulk";
import {Scroll} from "../../../../database/scroll";

interface IReceiverDAO {
    save(receiver: Receiver): Promise<Receiver>;
    getBySendIds(sendIds: string[], scroll?: Scroll<any>): Promise<Receiver[]>;
    createBulk(config?: BulkConfig): Promise<Bulk>;
    createScroll(): Promise<Scroll<any>>;
}

export abstract class ReceiverDAO implements IReceiverDAO {
    /* STATIC */

    /* INSTANCE */
    public abstract save(receiver: Receiver): Promise<Receiver>;

    public abstract getBySendIds(sendIds: string[], scroll?: Scroll<any>): Promise<Receiver[]>;

    public abstract createBulk(config?: BulkConfig): Promise<Bulk>;

    public abstract createScroll(): Promise<Scroll<any>>;
}
