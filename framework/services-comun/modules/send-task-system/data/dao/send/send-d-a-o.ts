import {Send} from "../../model/send";

export interface ISendDAO {
    save(send: Send): Promise<Send>;

    getPending(): Promise<Send[]>;

    findByTransmissionId(transmissionId: string): Promise<Send>;
}

export abstract class SendDAO implements ISendDAO {
    /* STATIC */

    /* INSTANCE */
    public abstract save(send: Send): Promise<Send>;

    public abstract getPending(): Promise<Send[]>;

    public abstract findByTransmissionId(transmissionId: string): Promise<Send>;
}
