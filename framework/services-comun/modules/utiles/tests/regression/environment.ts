import {readJSON} from "services-comun/modules/utiles/fs";
//import {EService, SERVICES} from "../../../../../services-comun-meteored/modules/services/config";

type TData = Record<"local"|"production"|"test", TEnvironment>;

export type TEnvironment = {
    baseUrl: string;
    host?: string;
    gke?: GKE;
}

export type GKE = {
    context: string;
    namespace: string;
}


export class Env {
    /* STATIC */
    private static data: Promise<TData>|null = null;

    private static async load(): Promise<TData> {
        if (!this.data) {
            this.data = readJSON<TData>('test/files/environment.json');
        }
        return this.data;
    }

    /**
     * @param baseUrl se espera en este campo SERVICES.servicio(EService.service).base
     * donde ".service" es el nombre del servivio a testar.
     * */
    public static async local(baseUrl: string): Promise<TEnvironment> {
        return {
            baseUrl: baseUrl,
        }

    }

    public static async prod(): Promise<TEnvironment> {
        return this.load().then(data => data.production);
    }

    public static async test(): Promise<TEnvironment> {
        return this.load().then(data => data.test);
    }

    /* INSTANCE */
    private constructor() {
    }
}

