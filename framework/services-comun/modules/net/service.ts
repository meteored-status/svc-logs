import crypto from "crypto";

import {INet, INetService, INetServiceBase, Net} from "./config/net";
import {ConfigService} from "../services/config";

export class Service {
    /* STATIC */
    private static PUERTO_HTTP = 8100;
    private static PUERTO_HTTPS = 4433;

    /* INSTANCE */
    private readonly ports: NodeJS.Dict<number>;

    public constructor(private readonly map: Map<number, INetServiceBase>) {
        this.ports = {};
    }

    private get(servicio: number): INetService {
        const data = this.map.get(servicio) ?? {
            endpoint: "localhost",
            tags: [],
        };
        const base = this.ports[servicio] ??= parseInt(crypto.createHash('md5').update(`${data.endpoint}.${data.namespace ?? "default"}.svc.cluster.local`).digest("hex").substring(0, 8), 16) % (32768 - Service.PUERTO_HTTP);
        return {
            ...data,
            http: Service.PUERTO_HTTP + base,
            https: Service.PUERTO_HTTPS + base,
        };
    }

    public configuracion(servicio: number): INet {
        return Net.buildDefault(this.get(servicio));
    }

    public servicio(servicio: number): ConfigService {
        return ConfigService.build(this.configuracion(servicio));
    }
}
