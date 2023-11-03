import * as events from "node:events";

export declare interface HashElement<T> {
    on(event: "expire", listener: (elemento: HashElement<T>) => void): this;
    emit(event: "expire", elemento: HashElement<T>): boolean;
}

export class HashElement<T> extends events.EventEmitter {
    /* STATIC */
    public static build<T>(key: string, value: T, ttl?: number, autoremove: boolean=false): HashElement<T> {
        return new this<T>(key, value, ttl, autoremove);
    }

    /* INSTANCE */
    private timeout: NodeJS.Timeout|null;
    public get value(): T {
        return this.valor
    }

    private constructor(public readonly key: string, private valor: T, ttl: number=0, public readonly autoremove: boolean=false) {
        super();

        if (ttl>0) {
            this.timeout = setTimeout(() => {
                this.timeout = null;
                this.expire();
            }, ttl);
        } else {
            this.timeout = null;
            setImmediate(() => {
                this.expire();
            });
        }
    }

    public expire(): void {
        this.clear();

        this.emit("expire", this);
    }

    public clear(): void {
        if (this.timeout!=null) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }

    public update(value: T, ttl: number): void {
        this.valor = value;
        this.updateTTL(ttl);
    }

    public updateTTL(ttl: number): void {
        this.clear();
        if (ttl>0) {
            this.timeout = setTimeout(() => {
                this.timeout = null;
                this.expire();
            }, ttl);
        } else {
            setImmediate(() => {
                this.expire();
            });
        }
    }
}
