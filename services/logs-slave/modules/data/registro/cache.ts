import type {IRAWDataCache} from ".";

export interface IRegistroCache {
    status: string;
    reserva: boolean;
    escalonada: boolean;
}

export interface IRegistroCacheApp {
    status: string;
}

export class RegistroCache implements IRegistroCache {
    /* STATIC */
    public static build(data: IRAWDataCache): RegistroCache {
        return new this({
            status: data.status,
            reserva: data.reserve.used,
            escalonada: data.tiered.fill,
        });
    }

    /* INSTANCE */
    public get status(): string { return this.data.status; }
    public get reserva(): boolean { return this.data.reserva; }
    public get escalonada(): boolean { return this.data.escalonada; }

    protected constructor(private data: IRegistroCache) {
    }

    public toJSON(): IRegistroCache {
        return {
            status: this.data.status,
            reserva: this.data.reserva,
            escalonada: this.data.escalonada,
        };
    }

    public toAPP(): IRegistroCacheApp {
        return {
            status: this.data.status,
        };
    }
}
