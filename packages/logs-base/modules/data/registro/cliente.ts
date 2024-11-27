import {UAParser} from "ua-parser-js";

import {Crawler} from "../crawler";
import type {IRAWDataClient} from ".";
import {type IRegistroLocalizacion, RegistroLocalizacion} from "./localizacion";

interface IAgent {
    raw: string;
    browser?: {
        name?: string;
        version?: string;
        major?: string;
        type?: string;
    },
    os?: {
        name?: string;
        version?: string;
    },
    device?: {
        model?: string;
        type?: string;
        vendor?: string;
    }
}

export interface IRegistroCliente {
    crawler?: string;
    device: string;
    ip: string;
    location: IRegistroLocalizacion;
    agent?: IAgent;
}

export class RegistroCliente implements IRegistroCliente {
    /* STATIC */
    public static build(data: IRAWDataClient): RegistroCliente {
        let crawler = Crawler.test(data.request.ua)?.name;
        if (crawler==undefined && data.ip.class=="searchEngine") {
            crawler = "Unknown";
        }

        let agent: IAgent|undefined;
        if (data.request.ua!=undefined && data.request.ua.length>0) {
            const tmp = UAParser(data.request.ua);
            agent = {
                raw: tmp.ua,
            };
            if (tmp.browser.name!=undefined) {
                agent.browser = {
                    name: tmp.browser.name,
                    version: tmp.browser.version,
                    major: tmp.browser.major,
                    type: tmp.browser.type,
                };
            }
            if (tmp.os.name!=undefined) {
                agent.os = {
                    name: tmp.os.name,
                    version: tmp.os.version,
                };
            }
            if (tmp.device.model!=undefined) {
                agent.device = {
                    model: tmp.device.model,
                    type: tmp.device.type,
                    vendor: tmp.device.vendor,
                };
            }
        }

        const location = RegistroLocalizacion.build(data.ip.value);

        return new this({
            crawler,
            device: data.device.type,
            ip: data.ip.value,
            location,
            agent,
        }, location);
    }

    /* INSTANCE */
    public get crawler(): string|undefined { return this.data.crawler; };
    public get device(): string { return this.data.device; };
    public get ip(): string { return this.data.ip; };
    public get agent(): IAgent|undefined { return this.data.agent; };

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
