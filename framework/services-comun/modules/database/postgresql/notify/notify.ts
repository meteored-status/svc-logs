import {Pool, Client} from "pg";
import {debug} from "../../../utiles/log";

export type NotifyCallback = (payload: string) => void;

export class Notify {
    /* STATIC */
    private static _instance: Notify|null = null;

    public static init(pool: Pool): Notify {
        return this._instance ??= new Notify(pool);
    }

    /* INSTANCE */
    private client: Promise<Client>|null;
    private readonly callbacks: Record<string, NotifyCallback[]>;
    private constructor(private readonly pool: Pool) {
        this.client = null;
        this.callbacks = {};
    }

    private async connect(): Promise<void> {
        if (!this.client) {
            debug(`Connecting to PostgreSQL for NOTIFY/LISTEN`);
            const c = new Client(this.pool.options);
            this.client = c.connect().then(() => c);

            const client = await this.client;

            client.on('error', err => {
                console.error('PostgreSQL client error:', err);
                this.client = null; // Reset client on error
            });

            // Comprobamos si hay suscripciones previas
            if (Object.keys(this.callbacks).length > 0) {
                debug(`Re-subscribing to channels: ${Object.keys(this.callbacks).join(', ')}`);
                for (const channel of Object.keys(this.callbacks)) {
                    await client.query(`LISTEN ${channel}`);
                }
            }

            client.on('notification', msg => {
                const channel = msg.channel;
                const payload = msg.payload || '';

                const cbs = this.callbacks[channel];
                if (cbs) {
                    for (const cb of cbs) {
                        cb(payload);
                    }
                }
            });
        }
    }

    public async listen(channel: string, callback: NotifyCallback): Promise<void> {
        await this.connect();
        const client = await this.client;

        if (!client) {
            throw new Error('Failed to acquire PostgreSQL client');
        }

        if (!this.callbacks[channel]) {
            debug(`Listening to channel: ${channel}`);
            await client.query(`LISTEN ${channel}`);
            this.callbacks[channel] = [];
        }

        this.callbacks[channel].push(callback);
    }


}
