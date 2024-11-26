import {UAParser, type IResult} from "ua-parser-js";

import {Crawler} from "../crawler";
import type {IRAWDataClient} from ".";
import {type IRegistroLocalizacion, RegistroLocalizacion} from "./localizacion";

export interface IRegistroCliente {
    crawler?: string;
    device: string;
    ip: string;
    location: IRegistroLocalizacion;
    ua?: IResult;
}

export class RegistroCliente implements IRegistroCliente {
    /* STATIC */
    public static build(data: IRAWDataClient): RegistroCliente {
        let crawler = Crawler.test(data.request.ua)?.name;
        if (crawler==undefined && data.ip.class=="searchEngine") {
            crawler = "Unknown";
        }

        const location = RegistroLocalizacion.build(data.ip.value);

        return new this({
            crawler,
            device: data.device.type,
            ip: data.ip.value,
            location,
            ua: data.request.ua!=undefined && data.request.ua.length>0 ?
                UAParser(data.request.ua) : undefined,
        }, location);
    }

    /* INSTANCE */
    public get crawler(): string|undefined { return this.data.crawler; };
    public get device(): string { return this.data.device; };
    public get ip(): string { return this.data.ip; };
    public get ua(): IResult|undefined { return this.data.ua; };

    protected constructor(private data: IRegistroCliente, public readonly location: RegistroLocalizacion) {
    }

    public toJSON(): IRegistroCliente {
        return {
            crawler: this.data.crawler,
            device: this.data.device,
            ip: this.data.ip,
            location: this.location.toJSON(),
            ua: this.data.ua,
        };
    }
}
