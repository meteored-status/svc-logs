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
    private static BACKENDS: Record<string, Backends> = {
        "ed": {},
        "fce": {},
        "motor": {},
        "mr": {
            "34.38.93.178": "GKE Bélgica",
            "34.95.250.252": "GKE Brasil",
            "34.61.102.55": "GKE Iowa",
            "34.105.71.156": "GKE Oregón",
        },
        "tiempo": {
            "34.38.93.178": "GKE Bélgica",
            "34.95.250.252": "GKE Brasil",
            "34.61.102.55": "GKE Iowa",
            "34.105.71.156": "GKE Oregón",
            "162.55.237.104": "Europa 1",
            "168.119.35.23": "Europa 2",
            "168.119.89.109": "Europa 3",
            "168.119.6.46": "Europa 4",
            "116.202.117.81": "Europa 5",
            "158.69.127.191": "Canadá 1",
            "51.222.10.187": "Canadá 3",
            "51.222.255.218": "Canadá 4",
            "51.222.255.219": "Canadá 5",
            "51.222.41.96": "Canadá 6",
            "158.69.26.17": "Canadá 7",
            "147.135.105.138": "Oregón 1",
            "51.81.166.12": "Oregón 2",
            "51.81.166.122": "Oregón 3",
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
