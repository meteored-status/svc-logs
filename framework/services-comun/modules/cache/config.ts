export interface IConfigCache {
    enabled: boolean;
    dir: string;
    paralelizar: boolean;
}
export class ConfigCache implements IConfigCache {
    public readonly enabled: boolean;
    public readonly dir: string;
    public readonly paralelizar: boolean;

    public constructor(protected readonly defecto: IConfigCache, protected readonly user: Partial<IConfigCache>) {
        this.enabled = user.enabled??defecto.enabled;
        this.dir = user.dir??defecto.dir;
        this.paralelizar = user.paralelizar??defecto.paralelizar;
    }

    public disableCache(): ConfigCache {
        return new ConfigCache(this.defecto,{
            enabled: false,
        });
    }
}
