import {UAParser, type IResult} from "ua-parser-js";

import {Crawler} from "../crawler";
import type {IRAWDataClient} from ".";
import {type IRegistroLocalizacion, RegistroLocalizacion} from "./localizacion";

export interface IRegistroCliente {
    crawler?: string;
    device: string;
    ip: string;
    location: IRegistroLocalizacion;
    agent?: Partial<IResult>;
}

export class RegistroCliente implements IRegistroCliente {
    /* STATIC */
    public static build(data: IRAWDataClient): RegistroCliente {
        let crawler = Crawler.test(data.request.ua)?.name;
        if (crawler==undefined && data.ip.class=="searchEngine") {
            crawler = "Unknown";
        }

        let ua: Partial<IResult> = {};
        if (data.request.ua!=undefined && data.request.ua.length>0) {
            const tmp = UAParser(data.request.ua);
            ua.ua = tmp.ua;
            if (tmp.browser.name!=undefined) {
                ua.browser = tmp.browser;
            }
            if (tmp.cpu.architecture!=undefined) {
                ua.cpu = tmp.cpu;
            }
            if (tmp.device.model!=undefined) {
                ua.device = tmp.device;
            }
            if (tmp.engine.name!=undefined) {
                ua.engine = tmp.engine;
            }
            if (tmp.os.name!=undefined) {
                ua.os = tmp.os;
            }
        }

        const location = RegistroLocalizacion.build(data.ip.value);

        return new this({
            crawler,
            device: data.device.type,
            ip: data.ip.value,
            location,
            agent: Object.keys(ua).length>0 ? ua : undefined,
        }, location);
    }

    /* INSTANCE */
    public get crawler(): string|undefined { return this.data.crawler; };
    public get device(): string { return this.data.device; };
    public get ip(): string { return this.data.ip; };
    public get agent(): Partial<IResult>|undefined { return this.data.agent; };

    protected constructor(private data: IRegistroCliente, public readonly location: RegistroLocalizacion) {
    }

    public toJSON(): IRegistroCliente {
        return {
            crawler: this.data.crawler,
            device: this.data.device,
            ip: this.data.ip,
            location: this.location.toJSON(),
            agent: this.data.agent,
        };
    }
}
