import type {IRAWDataOrigin} from ".";
import {type IRegistroLocalizacion, RegistroLocalizacion} from "./localizacion";

export interface IRegistroOrigen {
    status: number;
    ip: string;
    nombre?: string;
    location: IRegistroLocalizacion;
    bytes: number;
}

export class RegistroOrigen implements IRegistroOrigen {
    /* STATIC */
    public static build(origen?: IRAWDataOrigin, names: Record<string, string>={}): RegistroOrigen|undefined {
        if (origen==undefined) {
            return undefined;
        }

        const location = RegistroLocalizacion.build(origen.ip);

        return new this({
            status: origen.response.status,
            ip: origen.ip,
            nombre: names[origen.ip],
            location,
            bytes: origen.response.bytes,
        }, location);
    }

    /* INSTANCE */
    public get status(): number { return this.data.status; }
    public get ip(): string { return this.data.ip; }
    public get nombre(): string|undefined { return this.data.nombre; }
    public get bytes(): number { return this.data.bytes; }

    protected constructor(private data: IRegistroOrigen, public readonly location: RegistroLocalizacion) {
    }

    public toJSON(): IRegistroOrigen {
        return {
            status: this.data.status,
            ip: this.data.ip,
            nombre: this.data.nombre,
            location: this.location.toJSON(),
            bytes: this.data.bytes,
        };
    }
}
