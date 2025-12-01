import type {IRAWDataCache} from ".";

export interface IRegistroCache {
    status: string;
    reserva: boolean;
    escalonada: boolean;
    // bytes: number;
    // codigo: number;
}

export class RegistroCache implements IRegistroCache {
    /* STATIC */
    public static build(data: IRAWDataCache): RegistroCache {
        return new this({
            status: data.status,
            reserva: data.reserve.used,
            escalonada: data.tiered.fill,
            // bytes: data.response.bytes,
            // codigo: data.response.status,
        });
    }

    /* INSTANCE */
    public get status(): string { return this.data.status; }
    public get reserva(): boolean { return this.data.reserva; }
    public get escalonada(): boolean { return this.data.escalonada; }
    // public get bytes(): number { return this.data.bytes; }
    // public get codigo(): number { return this.data.codigo; }

    protected constructor(private data: IRegistroCache) {
    }

    public toJSON(): IRegistroCache {
        return {
            status: this.data.status,
            reserva: this.data.reserva,
            escalonada: this.data.escalonada,
            // bytes: this.data.bytes,
            // codigo: this.data.codigo,
        };
    }
}
