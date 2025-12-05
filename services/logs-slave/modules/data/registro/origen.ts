import type {IRAWDataOrigin} from ".";

export interface IRegistroOrigen {
    ip: string;
    nombre?: string;
}

export class RegistroOrigen implements IRegistroOrigen {
    /* STATIC */
    public static build(origen?: IRAWDataOrigin, names: Record<string, string>={}): RegistroOrigen|undefined {
        if (!origen) {
            return undefined;
        }

        return new this({
            ip: origen.ip,
            nombre: names[origen.ip],
        });
    }

    /* INSTANCE */
    public get ip(): string { return this.data.ip; }
    public get nombre(): string|undefined { return this.data.nombre; }

    protected constructor(private data: IRegistroOrigen) {
    }

    public toJSON(): IRegistroOrigen {
        return {
            ip: this.data.ip,
            nombre: this.data.nombre,
        };
    }
}
