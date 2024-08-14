import {IRespuesta} from "../../net/interface";
import {IComponent} from "../common/interface";

export interface ISpec<T> {
    service: number;
    name: string;
    data: T;
}

export interface IClientConfig {
    server: string;
}

export class Client {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly config: IClientConfig) {
    }

    /**
     * Carga un spec a través de su identificador de servicio.
     * @param service Id del servicio.
     * @param name Grupo del servicio.
     */
    public async loadSpec<K>(service: number, name: string): Promise<ISpec<K>> {
        const url: string = `${this.config.server}/status/external/spec/load?service=${service}&name=${name}`;
        const result = await fetch(url, {
            method: 'GET',
        });
        const response: IRespuesta<ISpec<any>> = await result.json();
        if (!response || !response.data) return Promise.reject('No data found');
        return {
            service: response.data.service,
            name: response.data.name,
            data: typeof response.data.data === 'string' ? JSON.parse(response.data.data) : response.data.data
        };
    }

    /**
     * Guarda el Spec.
     * @param spec Datos del spec.
     */
    public async saveSpec<K>(spec: ISpec<K>): Promise<ISpec<K>> {
        const url: string = `${this.config.server}/status/external/spec/save`;
        const obj: ISpec<string> = {
            service: spec.service,
            name: spec.name,
            data: JSON.stringify(spec.data)
        };
        const result = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(obj)
        });
        const response: IRespuesta<ISpec<K>> = await result.json();
        if (!response || !response.data) return Promise.reject('No data found');
        return response.data;
    }

    /**
     * Guarda el estado de los componentes.
     * @param components Array de componentes.
     */
    public async saveStatus(components: IComponent[]): Promise<void> {
        const url: string = `${this.config.server}/status/external/component/save`;
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({components})
        });
    }
}



let instancia: Client|null = null;
export default (config: IClientConfig)=>{
    return instancia??=new Client(config);
};
