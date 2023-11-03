declare var TEST: boolean;
declare var DESARROLLO: boolean;

export enum EDominio {
    // base = 0,
    // www = 1,
    // services = 2,
    // panel_usuarios = 3,
    status = 4,
}

class Dominio {
    /* STATIC */
    public static INSTANCE: Dominio;
    static {
        this.INSTANCE = new this();
    }

    /* INSTANCE */
    public readonly cookies: string;
    public readonly defecto: string;
    public readonly defecto_base: string;
    private readonly dominios: Map<EDominio, string>;
    private readonly hosts: Map<EDominio, string>;
    private readonly redirecciones: Map<EDominio, EDominio>;

    private constructor() {
        this.dominios = new Map<EDominio, string>();
        this.hosts = new Map<EDominio, string>();
        this.redirecciones = new Map<EDominio, EDominio>();
        this.cookies = ".meteored.com";

        if (DESARROLLO) {
            this.defecto = `https://local-www.meteored.com`;

            this.add(EDominio.status, `https://local-status.meteored.com`);
        } else if (TEST) {
            this.defecto = `https://test-www.meteored.com`;

            this.add(EDominio.status, `https://test-status.meteored.com`);
        } else {
            this.defecto = `https://www.meteored.com`;

            this.add(EDominio.status, `https://status.meteored.com`);
        }
        this.defecto_base = this.defecto.split("://")[1]??this.defecto;
    }

    private add(dominio: EDominio, url: string): void {
        this.dominios.set(dominio, url);
        this.hosts.set(dominio, url.split("://")[1]??url);
    }

    private addRedireccion(dominio: EDominio, redireccion: EDominio): void {
        this.redirecciones.set(dominio, redireccion);
    }

    public get(dominio: EDominio): string {
        return this.dominios.get(dominio)??this.defecto;
    }

    public getRedireccion(dominio: EDominio): EDominio|undefined {
        return this.redirecciones.get(dominio);
    }

    public search(host: string): EDominio {
        for (const [key, value] of this.dominios.entries()) {
            if (value==host) {
                return key;
            }
        }
        return EDominio.status;
    }

    public host(dominio: EDominio): string {
        return this.hosts.get(dominio)??this.defecto_base;
    }

    public searchHost(host: string): EDominio {
        for (const [key, value] of this.hosts.entries()) {
            if (value==host) {
                return key;
            }
        }
        return EDominio.status;
    }
}

const dominio = Dominio.INSTANCE;
export default dominio;
