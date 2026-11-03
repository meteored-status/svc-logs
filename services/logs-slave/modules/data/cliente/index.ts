import type {Backends} from "./backends";
import {ClienteError} from "./error";
import type {ClienteGCS} from "./gcs";
import type {Grupo} from "./grupo";

export interface ICliente {
    id: string;
    backends?: Backends;
}

export class Cliente {
    /* STATIC */
    private static readonly BACKENDS: Record<string, Backends> = {
        "ed": {},
        "fce": {},
        "hoteles": {},
        "motor": {},
        "motenic": {},
        "mr": {
            "34.38.93.178": "GKE Bélgica",
            "34.95.250.252": "GKE Brasil",
            "34.105.71.156": "GKE Oregón",
        },
        "tiempo": {
            "34.38.93.178": "GKE Bélgica",
            "34.95.250.252": "GKE Brasil",
            "34.105.71.156": "GKE Oregón",
        }
    };
    public static async searchID(id: string): Promise<Cliente> {
        const data = this.BACKENDS[id];
        if (!data) {
            return Promise.reject(new ClienteError(`Cliente ${id} no encontrado`));
        }

        return new this({
            id,
            backends: data,
        });
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

    public proyecto(service?: string): string|undefined {
        return this.grupo ?? service;
    }
}
