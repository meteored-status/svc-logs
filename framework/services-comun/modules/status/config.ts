export enum TService {
    MR_ALERTAS      = 1,
    MR_IMG_MODELOS  = 2,
    MR_REDACCION    = 3,
    MR_CMP          = 4,
    MR_HURACANES    = 5,
    MR_AIR_QUALITY  = 6,
    MR_PUNTOS       = 7,
    MR_NEWSLETTER   = 8,
    MR_VIDEOS       = 9,
    MR_ADS          = 10,
}

export interface IServiceInfo {
    name: string;
    project: string;
    namespace: string;
}

const SERVICE_MAP: Map<TService, IServiceInfo> = new Map<TService, IServiceInfo>();

SERVICE_MAP.set(TService.MR_ALERTAS, {
    name: 'Alertas',
    project: 'meteored-svc-data-alertas',
    namespace: 'Meteored Services'
});
SERVICE_MAP.set(TService.MR_IMG_MODELOS, {
    name: 'Modelos',
    project: 'meteored-svc-img-modelos',
    namespace: 'Meteored Services'
});
SERVICE_MAP.set(TService.MR_REDACCION, {
    name: 'Redacción',
    project: 'meteored-svc-redaccion',
    namespace: 'Meteored Services'
});
SERVICE_MAP.set(TService.MR_CMP, {
    name: 'CMP',
    project: 'meteored-svc-cmp',
    namespace: 'Meteored Services'
});
SERVICE_MAP.set(TService.MR_HURACANES, {
    name: 'Huracanes',
    project: 'meteored-svc-huracanes',
    namespace: 'Meteored Services'
});
SERVICE_MAP.set(TService.MR_AIR_QUALITY, {
    name: 'Air Quality',
    project: 'meteored-svc-air-quality',
    namespace: 'Meteored Services'
});
SERVICE_MAP.set(TService.MR_PUNTOS, {
    name: 'Puntos',
    project: 'meteored-svc-puntos',
    namespace: 'Meteored Services'
});
SERVICE_MAP.set(TService.MR_NEWSLETTER, {
    name: 'Newsletter',
    project: 'meteored-svc-newsletter',
    namespace: 'Meteored Services'
});
SERVICE_MAP.set(TService.MR_VIDEOS, {
    name: 'Vídeos',
    project: 'meteored-svc-data-video',
    namespace: 'Meteored Services'
});
SERVICE_MAP.set(TService.MR_ADS, {
    name: 'Ads',
    project: 'meteored-svc-ads',
    namespace: 'Meteored Services'
});

class ServiceMap {
    /* STATIC */

    /* INSTANCE */
    constructor(private readonly _map: Map<TService, IServiceInfo>) {
    }

    public getService(type: TService): IServiceInfo {
        return this._map.get(type) as IServiceInfo;
    }

    public getTypes(): TService[] {
        return Array.from(this._map.keys());
    }
}

export default new ServiceMap(SERVICE_MAP);
