export interface ISubdominio {
    nombre: string;
    scheme?: string;
}

export interface ISubdominioRedirigido {
    nombre: string;
    redirigido: string;
}

export type ISubdominioCompleto = Readonly<Required<ISubdominio>>;

export interface IDominioConfig {
    dominio: string;
    subdominios?: {
        habilitados?: string[]; // www por defecto está habilitado
        listado?: ISubdominio[]; // base y www se sobreentienden
        redirigidos?: ISubdominioRedirigido[];
    };
}

export class Dominio {
    /* STATIC */
    public static readonly BASE: ISubdominioCompleto = {
        nombre: "",
        scheme: `https`,
    };
    public static readonly WWW: ISubdominioCompleto = {
        nombre: "www",
        scheme: `https`,
    };

    /* INSTANCE */
    protected readonly SUBDOMINIO_BASE = Dominio.BASE;
    protected readonly SUBDOMINIO_WWW = Dominio.WWW;

    public readonly BASE = this.SUBDOMINIO_BASE.nombre;
    public readonly WWW = this.SUBDOMINIO_WWW.nombre;

    public readonly nombre: string;
    public readonly cookies: string;
    public readonly defecto: string;
    public readonly defecto_base: string;
    public readonly dominio: string;
    private readonly dominios: Map<string, string>;
    private readonly hosts: Map<string, string>;
    private readonly redirecciones: Map<string, string>;

    protected constructor(config: IDominioConfig) {
        this.nombre = `${config.dominio.charAt(0).toUpperCase()}${config.dominio.slice(1)}`;
        this.cookies = `.${config.dominio}`;
        this.dominio = config.dominio;
        this.dominios = new Map<string, string>();
        this.hosts = new Map<string, string>();
        this.redirecciones = new Map<string, string>();

        let coletilla_guion = "";
        let coletilla_punto = "";
        if (DESARROLLO) {
            coletilla_guion = "local-";
            coletilla_punto = "local.";
        } else if (TEST) {
            coletilla_guion = "test-";
            coletilla_punto = "test.";
        }

        const habilitados = [this.WWW, ...config.subdominios?.habilitados??[]];
        const listado: ISubdominioCompleto[] = [this.SUBDOMINIO_BASE, this.SUBDOMINIO_WWW,
            ...config.subdominios?.listado?.map(subdominio=>({
                nombre: subdominio.nombre,
                scheme: subdominio.scheme??`https://`,
            }))??[],
        ];
        const redirigidos: ISubdominioRedirigido[] = config.subdominios?.redirigidos??[];

        this.defecto_base = `${coletilla_guion}${this.SUBDOMINIO_WWW.nombre}.${config.dominio}`;
        this.defecto = `https://${this.defecto_base}`;
        for (const subdominio of listado) {
            if (subdominio.nombre.length>0) {
                this.add(subdominio.nombre, `${subdominio.scheme}://${coletilla_guion}${subdominio.nombre}.${config.dominio}`);
            } else {
                this.add(subdominio.nombre, `${subdominio.scheme}://${coletilla_punto}${config.dominio}`);
            }

            if (habilitados.indexOf(subdominio.nombre)<0 && !redirigidos.find(redirigido=>redirigido.nombre==subdominio.nombre)) {
                redirigidos.push({
                    nombre: subdominio.nombre,
                    redirigido: this.WWW,
                });
            }
        }

        for (const redirigido of redirigidos) {
            this.addRedireccion(redirigido.nombre, redirigido.redirigido);
        }
    }

    protected add(dominio: string, url: string): void {
        this.dominios.set(dominio, url);
        this.hosts.set(dominio, url.split("://")[1]??url);
    }

    private addRedireccion(dominio: string, redireccion: string): void {
        this.redirecciones.set(dominio, redireccion);
    }

    public get(dominio: string): string {
        return this.dominios.get(dominio)??this.defecto;
    }

    public getRedireccion(dominio: string): string|undefined {
        return this.redirecciones.get(dominio);
    }

    public search(host: string): string {
        for (const [key, value] of this.dominios.entries()) {
            if (value==host) {
                return key;
            }
        }
        return this.WWW;
    }

    public host(dominio: string): string {
        return this.hosts.get(dominio)??this.defecto_base;
    }

    public searchHost(host: string): string {
        for (const [key, value] of this.hosts.entries()) {
            if (value==host) {
                return key;
            }
        }
        return this.WWW;
    }
}
