/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 9c2ae191adc78c772cb8c50c0ef56d0d
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export interface IElevationConfig {
    api_key: string;
}

export interface IElevationResult {
    results: IElevationItem[];
    status: TResult;
}

export interface IElevationItem {
    elevation: number;
    location: ILocation;
    resolution: number;
}

export interface ILocation {
    lat: number;
    lng: number;
}

type TResult = "OK"|"DATA_NOT_AVAILABLE";

export class Client {
    /* STATIC */
    private static _BASE_URL: string = 'https://maps.googleapis.com/maps/api/elevation/json';

    private static _INSTANCE: Client|null = null;

    public static getInstance(config: IElevationConfig): Client {
        return this._INSTANCE ??= new Client(config);
    }

    /* INSTANCE */
    private constructor(private readonly config: IElevationConfig) {
    }

    public async elevation(lat: number, lon: number): Promise<IElevationResult> {
        if (!this.config) {return Promise.reject('Not configuration found');}
        const data: IElevationResult = await fetch(`${Client._BASE_URL}?locations=${lat},${lon}&key=${this.config.api_key}`).then(async response => await response.json());
        if (data.status != "OK") {return Promise.reject(data.status);}
        return data;
    }
}
