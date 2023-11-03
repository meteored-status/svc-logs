import {INet} from "../net/config/net";

export interface IConfigService {
    base: string;
    path?: string;
}
export class ConfigService implements IConfigService {
    /* STATIC */
    public static build(cfg: INet): ConfigService {
        return {
            base: cfg.endpoints.http[0],
            path: cfg.endpoints.paths?.[0],
        };
    }

    /* INSTANCE */
    public base: string;
    public path?: string;

    public constructor(defecto: IConfigService, user?: Partial<IConfigService>) {
        this.base = user?.base??defecto.base;
        this.path = user?.path??defecto.path;
    }
}
