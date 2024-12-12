import db from "services-comun/modules/utiles/mysql";

import type {Backends} from "./backends";
import {ClienteError} from "./error";
import {ClienteGCS} from "./gcs";
import type {Grupo} from "./grupo";

export interface ICliente {
    id: string;
    backends?: Backends;
}

export class Cliente {
    /* STATIC */
    public static async searchID(id: string): Promise<Cliente> {
        const [cliente] = await db.select<ICliente, Cliente>("SELECT * FROM clientes WHERE id=?", [id], {
            fn: (row)=>new this(row),
            // cache: {
            //     builder,
            //     key: id,
            //     ttl: 600000,
            // },
        });
        if (cliente==undefined) {
            return Promise.reject(new ClienteError(`Cliente ${id} no encontrado`));
        }

        return cliente;
    }

    /* INSTANCE */
    public readonly id: string;
    public backends: Backends;

    public grupo?: string;
    public gcs?: ClienteGCS;

    private readonly _backends: Backends;

    private constructor(data: ICliente) {
        this.id = data.id;
        this._backends = data.backends ?? {};
        this.backends = {
            ...this._backends,
        };
    }

    public aplicarGrupo(grupo: Grupo): void {
        this.grupo = grupo.id;
        this.backends = {
            ...this._backends,
            ...grupo.backends,
        };
    }

    public aplicarGCS(gcs: ClienteGCS): void {
        this.gcs = gcs;
    }
}
