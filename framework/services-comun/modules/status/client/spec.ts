import {TService} from "../config";
import {mergeDeep} from "../../utiles/object";
import {Client, ISpec as IClientSpec} from "./client";

interface ISpec<K> {
    service: number;
    group?: string;
    data: K;
}

export class Spec<K> {
    /* STATIC */

    /* INSTANCE */
    private _data?: K;
    private _id?: string;

    protected constructor(public readonly type: TService, private readonly client: Client, private readonly group?: string) {
    }

    public get data(): K {
        return this._data as K;
    }

    public async load(def: K): Promise<Spec<K>> {
        const spec: IClientSpec<K>|undefined = await this.client.loadSpec<K>(this.type, this.group).catch(() => undefined);

        let data: ISpec<K>;
        let doc: string|undefined = undefined;
        if (!spec) {
            data = {
                service: this.type,
                group: this.group,
                data: def
            };
        } else {
            data = mergeDeep({}, {data: def}, spec);
            doc = spec.id;
        }
        this._data = data.data;
        this._id = doc;

        return this;
    }

    public async save(): Promise<void> {
        const spec: IClientSpec<K>|undefined = await this.client.saveSpec<K>({
            id: this._id??undefined,
            service: this.type,
            group: this.group,
            data: this._data as K
        });

        if (!this._id) {
            this._id = spec.id;
        }
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
