/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 1c3646b2343e730dd76b1cbec39c33af
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {mergeDeep} from "../../utiles/object";
import type {Client, ISpec as IClientSpec} from "./client";
import {warning} from "../../utiles/log";

interface ISpec<K> {
    service: number;
    name: string;
    data: K;
}

export class Spec<K> {
    /* INSTANCE */
    private _data?: K;

    protected constructor(public readonly service: number, private readonly client: Client, private readonly name: string) {
    }

    public get data(): K {
        return this._data as K;
    }

    public async load(def: K): Promise<Spec<K>> {
        const spec: IClientSpec<K>|undefined = await this.client.loadSpec<K>(this.service, this.name).catch(err => {
            warning(`Error loading spec: `, err);
            return undefined;
        });

        let data: ISpec<K>;
        if (!spec) {
            data = {
                service: this.service,
                name: this.name,
                data: def
            };
        } else {
            data = mergeDeep({}, {data: def}, spec);
        }
        this._data = data.data;

        return this;
    }

    public async save(): Promise<void> {
        await this.client.saveSpec<K>({
            service: this.service,
            name: this.name,
            data: this._data as K
        });
    }
}

export interface IWorkspace<T> {
    data: T;
}

export interface IClusters<T extends IClusterData> {
    [k:string]: ICluster<T>;
}

export interface ICluster<T extends IClusterData> {
    name: string;
    data: T;
}

export interface IClusterData {

}
