import crypto from "crypto";

import {INet, INetService, INetServiceBase, Net} from "./config/net";
import {ConfigService} from "../services/config";

export class Service {
    /* STATIC */
    private static PUERTO_HTTP = 8100;
    private static PUERTO_HTTPS = 4433;

    /* INSTANCE */
    private readonly ports: NodeJS.Dict<number>;
    private readonly services: Map<string, number>;

    public constructor(private readonly map: Map<number, INetServiceBase>, builder?: (id: number)=>string) {
        this.ports = {};
        this.services = new Map<string, number>();
        if (builder!=undefined) {
            for (const [id, data] of map.entries()) {
                this.services.set(builder(id), id);
            }
        }
    }

    private get(servicio: number): INetService {
        const data = this.map.get(servicio) ?? {
            endpoint: "localhost",
            tags: [],
        };
        if (data.alias==undefined) {
            const base = this.ports[servicio] ??= parseInt(crypto.createHash('md5').update(`${data.endpoint}.${data.namespace ?? "default"}.svc.cluster.local`).digest("hex").substring(0, 8), 16) % (32768 - Service.PUERTO_HTTP);
            return {
                ...data,
                http: Service.PUERTO_HTTP + base,
                https: Service.PUERTO_HTTPS + base,
            };
        }

        const padre = this.get(data.alias);
        return {
            ...data,
            http: padre.http,
            https: padre.https,
        };
    }

    public configuracion(servicio: number): INet;
    public configuracion(servicio: string): INet;
    public configuracion(servicio: string|number): INet {
        if (typeof servicio=="string") {
            const id = this.services.get(servicio);
            if (id==undefined) {
                throw new Error(`Servicio ${servicio} no encontrado`);
            }
            servicio = id;
        }
        return Net.buildDefault(this.get(servicio));
    }

    public servicio(servicio: number): ConfigService {
        return ConfigService.build(this.configuracion(servicio));
    }
}
