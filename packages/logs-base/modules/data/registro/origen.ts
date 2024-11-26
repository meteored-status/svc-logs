import type {IRAWDataOrigin} from ".";
import {type IRegistroLocalizacion, RegistroLocalizacion} from "./localizacion";

export interface IRegistroOrigen {
    status: number;
    ip: string;
    location: IRegistroLocalizacion;
    bytes: number;
}

export class RegistroOrigen implements IRegistroOrigen {
    /* STATIC */
    public static build(origen?: IRAWDataOrigin): RegistroOrigen|undefined {
        if (origen==undefined) {
            return undefined;
        }

        const location = RegistroLocalizacion.build(origen.ip);

        return new this({
            status: origen.response.status,
            ip: origen.ip,
            location,
            bytes: origen.response.bytes,
        }, location);
    }

    /* INSTANCE */
    public get status(): number { return this.data.status; }
    public get ip(): string { return this.data.ip; }
    public get bytes(): number { return this.data.bytes; }

    protected constructor(private data: IRegistroOrigen, public readonly location: RegistroLocalizacion) {
    }

    public toJSON(): IRegistroOrigen {
        return {
            status: this.data.status,
            ip: this.data.ip,
            location: this.location.toJSON(),
            bytes: this.data.bytes,
        };
    }
}
