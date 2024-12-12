import builder from "services-comun/modules/database/mysql/cache/memory";
import db from "services-comun/modules/utiles/mysql";

import {ClienteError} from "./error";

type HostTipo = "dedicated" | "k8s" | "vm" | "saas";
type HostServicio = "backend" | "database";

interface IHost {
    ip: string;
    nombre: string;
    grupo?: string;
    tipo: HostTipo;
    servicios: HostServicio[];
    enabled: boolean;
    img?: string;
    munin?: string;
    load?: string;
}

interface IHostMySQL {
    id: number;
    ip: string;
    nombre: string;
    grupo: string|null;
    tipo: HostTipo;
    servicios: string;
    enabled: boolean;
    img: string|null;
    munin: string|null;
    load: string|null;
}

export class Host implements IHost {
    /* STATIC */
    protected static build(data: IHostMySQL): Host {
        return new this(data.id, this.mysql2host(data));
    }

    protected static mysql2host(mysql: IHostMySQL): IHost {
        return {
            ip: mysql.ip,
            nombre: mysql.nombre,
            grupo: mysql.grupo??undefined,
            tipo: mysql.tipo,
            servicios: mysql.servicios.length>0 ?
                mysql.servicios.split(",") as HostServicio[] : [] as HostServicio[],
            enabled: mysql.enabled,
            img: mysql.img??undefined,
            munin: mysql.munin??undefined,
            load: mysql.load??undefined,
        }
    }

    public async findByID(id: number): Promise<Host> {
        const [host] = await db.select<IHostMySQL, Host>("SELECT * FROM hosts WHERE id=?", [id], {
            fn: (row)=>Host.build(row),
            cache: {
                builder,
                key: id,
                ttl: 600000,
            },
        });

        return host ?? await Promise.reject(new ClienteError(`Host ${id} not found`));
    }

    public async findByIP(ip: string): Promise<Host> {
        const [host] = await db.select<IHostMySQL, Host>("SELECT * FROM hosts WHERE ip=?", [ip], {
            fn: (row)=>Host.build(row),
            cache: {
                builder,
                key: ip.replaceAll(".", "-").replaceAll(":", "-"),
                ttl: 600000,
            },
        });

        return host ?? await Promise.reject(new ClienteError(`Host "${ip}" not found`));
    }

    /* INSTANCE */
    public get ip(): string { return this.data.ip; }
    public get nombre(): string { return this.data.nombre; }
    public get grupo(): string|undefined { return this.data.grupo; }
    public get tipo(): HostTipo { return this.data.tipo; }
    public get servicios(): HostServicio[] { return this.data.servicios; }
    public get enabled(): boolean { return this.data.enabled; }
    public get img(): string|undefined { return this.data.img; }
    public get munin(): string|undefined { return this.data.munin; }
    public get load(): string|undefined { return this.data.load; }

    protected constructor(public readonly id: number, private readonly data: IHost) {
    }

    // public toJSON(): IHost {
    //     return {
    //         ip: this.ip,
    //         nombre: this.nombre,
    //         grupo: this.grupo,
    //         tipo: this.tipo,
    //         servicios: this.servicios,
    //         enabled: this.enabled,
    //         img: this.img,
    //         munin: this.munin,
    //         load: this.load,
    //     };
    // }
}
