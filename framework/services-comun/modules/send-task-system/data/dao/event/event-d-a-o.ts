import {SendEvent} from "../../model/send-event";
import {Scroll} from "../../../../database/scroll";

export interface Search {
    size?: number;
    created?: {
        from?: Date;
        to?: Date;
    }
}

interface IEventDAO {
    save(event: SendEvent): Promise<SendEvent>;
    createScroll(): Promise<Scroll<any>>;
    search(options: Search, scroll?: Scroll<any>): Promise<SendEvent[]>;
}

export abstract class EventDAO implements IEventDAO {
    /* STATIC */

    /* INSTANCE */
    public abstract save(event: SendEvent): Promise<SendEvent>;

    public abstract createScroll(): Promise<Scroll<any>>;

    public abstract search(options: Search, scroll?: Scroll<any>): Promise<SendEvent[]>;
}
