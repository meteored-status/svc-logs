/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 427765690894c1eecb8314c4adc40493
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {SendEvent} from "../../model/send-event";
import type {Scroll} from "../../../../database/scroll";

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
    /* INSTANCE */
    public abstract save(event: SendEvent): Promise<SendEvent>;

    public abstract createScroll(): Promise<Scroll<any>>;

    public abstract search(options: Search, scroll?: Scroll<any>): Promise<SendEvent[]>;
}
