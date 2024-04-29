interface INetPuertos {
    http: number;
    https: number;
}
class NetPuertos implements INetPuertos {
    public readonly http: number;
    public readonly https: number;

    public constructor(defecto: INetPuertos, user: Partial<INetPuertos>) {
        this.http =  user.http??defecto.http;
        this.https = user.https??defecto.https;
    }
}

interface INetEndpoints {
    http: string[];
    https: string[];
    paths?: string[];
}
class NetEndpoints implements INetEndpoints {
    public readonly http: string[];
    public readonly https: string[];
    public readonly paths?: string[];

    public constructor(defecto: INetEndpoints, user: Partial<INetEndpoints>) {
        this.http =  user.http??defecto.http;
        this.https = user.https??defecto.https;
        this.paths = user.paths??defecto.paths;
    }
}

export interface INetServiceBase {
    endpoint: string;
    alias?: number;
    path?: string;
    maxConnections?: number;
    maxFilesize?: number;
    timeout?: number;
    desarrollo?: string;
    namespace?: string;
    tags: string[];
}

export interface INetService extends INetServiceBase, INetPuertos {
}

export interface INet {
    puertos: INetPuertos;
    endpoints: INetEndpoints;
    maxConnections?: number;
    timeout?: number;
    compress: boolean;
    cacheTags: string[];
    uploadDir: string;
    maxFileSize: number;
}
export class Net implements INet {
    /* STATIC */
    public static buildDefault(cfg: INetService): INet {
        const comun = {
            maxConnections: cfg.maxConnections,
            cacheTags: [...cfg.tags],
            compress: false,
            uploadDir: "files/tmp",
            maxFileSize: cfg.maxFilesize ?? 8 * 1024 + 1024, // 8MB
        };

        if (global.PRODUCCION) {
            // noinspection HttpUrlsUsage
            return {
                ...comun,
                puertos: {
                    http: 8080,
                    https: 4433,
                    // grpc: 50050,
                },
                endpoints: {
                    http: [`http://${cfg.endpoint}${cfg.namespace!=undefined?`.${cfg.namespace}.svc.cluster.local`:""}`],
                    https: [`https://${cfg.endpoint}${cfg.namespace!=undefined?`.${cfg.namespace}.svc.cluster.local`:""}`],
                    paths: cfg.path!=undefined ? [cfg.path] : undefined,
                    // grpc: `${cfg.endpoint}${cfg.namespace!=undefined?`.${cfg.namespace}.svc.cluster.local`:""}:50050`,
                },
            };
        }

        if (cfg.desarrollo==undefined) {
            return {
                ...comun,
                puertos: {
                    http: cfg.http,
                    https: cfg.https,
                },
                endpoints: {
                    http: [`http://localhost${cfg.http!=80?`:${cfg.http}`:""}`],
                    https: [`https://localhost${cfg.https!=443?`:${cfg.https}`:""}`],
                    paths: cfg.path!=undefined ? [cfg.path] : undefined,
                },
            };
        }

        const url = new URL(cfg.desarrollo);
        cfg.http = parseInt(url.port);
        cfg.https = cfg.http;

        return {
            ...comun,
            puertos: {
                http: cfg.http,
                https: cfg.https,
            },
            endpoints: {
                http: [cfg.desarrollo],
                https: [cfg.desarrollo],
                paths: cfg.path!=undefined ? [cfg.path] : undefined,
            },
        };

    }

    /* INSTANCE */
    public readonly puertos: NetPuertos;
    public readonly endpoints: NetEndpoints;
    public readonly maxConnections?: number;
    public readonly timeout?: number;
    public readonly compress: boolean;
    public readonly cacheTags: string[];
    public readonly uploadDir: string;
    public readonly maxFileSize: number;

    public constructor(defecto: INet, user: Partial<INet>) {
        this.puertos   = new NetPuertos(defecto.puertos, user.puertos??{});
        this.endpoints = new NetEndpoints(defecto.endpoints, user.endpoints??{});
        this.maxConnections = user.maxConnections??defecto.maxConnections;
        this.timeout = user.timeout??defecto.timeout;
        this.compress  = user.compress??defecto.compress;
        this.cacheTags = user.cacheTags??defecto.cacheTags;
        this.uploadDir = user.uploadDir??defecto.uploadDir;
        this.maxFileSize = user.maxFileSize??defecto.maxFileSize;
    }
}
