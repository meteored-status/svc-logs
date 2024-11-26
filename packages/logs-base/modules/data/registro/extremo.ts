import type {IRAWDataEdge} from ".";
import {type IRegistroLocalizacion, RegistroLocalizacion} from "./localizacion";

interface IRegistroExtremoBytes {
    headers: number;
    body: number;
    total: number;
    compression?: number;
}

export interface IRegistroExtremo {
    status: number;
    contentType: string;
    ip?: string;
    location?: IRegistroLocalizacion;
    bytes: IRegistroExtremoBytes;
}

export class RegistroExtremo implements IRegistroExtremo {
    /* STATIC */
    public static build(edge: IRAWDataEdge): RegistroExtremo {
        let ip: string|undefined;
        let location: RegistroLocalizacion|undefined;

        if (edge.server?.ip!=undefined) {
            ip = edge.server.ip;
            location = RegistroLocalizacion.build(ip);
        }

        return new this({
            status: edge.response.status,
            contentType: edge.response.contentType,
            ip,
            location,
            bytes: {
                headers: edge.response.bytes-edge.response.body.bytes,
                body: edge.response.body.bytes,
                total: edge.response.bytes,
                compression: edge.response.compression.ratio!=0 ?
                    edge.response.compression.ratio : undefined,
            },
        }, location);
    }

    /* INSTANCE */
    public get status(): number { return this.data.status; }
    public get contentType(): string { return this.data.contentType; }
    public get ip(): string|undefined { return this.data.ip; }
    public get bytes(): IRegistroExtremoBytes { return this.data.bytes; };

    protected constructor(private data: IRegistroExtremo, public readonly location?: RegistroLocalizacion) {
    }

    public toJSON(): IRegistroExtremo {
        return {
            status: this.data.status,
            contentType: this.data.contentType,
            ip: this.data.ip,
            location: this.location?.toJSON(),
            bytes: this.data.bytes,
        };
    }
}
