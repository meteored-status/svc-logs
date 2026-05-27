import type {INet} from "@mr/core-network/server/http/config/net";

export interface IConfigService {
    base: string;
    vpc: string;
    path?: string;
}
export class ConfigService implements IConfigService {
    /* STATIC */
    public static build(cfg: INet): ConfigService {
        return {
            base: cfg.endpoints.http[0],
            vpc: cfg.endpoints.http[0]
                .replace('switch', 'external')
                .replace('proxy', 'external')
                .replace('svc.cluster.local', `${process.env["ZONA"]??"desarrollo"}.gke.private`),
            path: cfg.endpoints.paths?.[0],
        };
    }

    /* INSTANCE */
    public base: string;
    public vpc: string;
    public path?: string;

    public constructor(defecto: IConfigService, user?: Partial<IConfigService>) {
        this.base = user?.base??defecto.base;
        this.vpc = user?.vpc??defecto.base;
        this.path = user?.path??defecto.path;
    }
}
