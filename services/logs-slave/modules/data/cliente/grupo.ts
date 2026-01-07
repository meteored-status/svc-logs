import type {Backends} from "./backends";
import {Cliente, type ICliente} from ".";

export interface IGrupo {
    id: string;
    cliente: ICliente;
    backends?: Backends;
}

export class Grupo implements IGrupo {
    /* STATIC */
    public static async searchID(id: string, grp?: string): Promise<Cliente> {
        return this.searchCliente(await Cliente.searchID(id), grp);
    }

    public static async searchCliente(cliente: Cliente, grp?: string): Promise<Cliente> {
        if (!grp) {
            return cliente;
        }

        cliente.aplicarGrupo(new this(cliente, {cliente, id: grp}));

        return cliente;
    }

    /* INSTANCE */
    public readonly id: string;
    public readonly backends: Backends;

    private constructor(public readonly cliente: Cliente, data: IGrupo) {
        this.id = data.id;
        this.backends = data.backends ?? {};
    }
}
