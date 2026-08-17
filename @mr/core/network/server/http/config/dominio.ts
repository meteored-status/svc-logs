/**
 * Editor: Diego Jesús Ramos Rodríguez
 * Fecha: Wed, 05 Aug 2026 08:27:07 GMT
 * Hash: 2c5da40be546d2b80d9d871e26134787
 * Versión: 2026.8.5+2-diegojesusramosrodriguez
 * Anterior: 2026.5.22+3-josantoniojimnez
 * Proyecto: https://github.com/estadiodeportivo/svc-www-v2.git
 */

/**
 * Subdominio habilitado con esquema de URL opcional.
 *
 * @property nombre - Nombre del subdominio (p. ej. `"api"`, `"static"`). Cadena vacía para el dominio raíz.
 * @property scheme - Esquema URL (`"https"`, `"http"`). Por defecto `"https"` si se omite.
 */
export interface ISubdominio {
    nombre: string;
    scheme?: string;
}

/**
 * Subdominio que redirige automáticamente a otro subdominio.
 *
 * @property nombre     - Nombre del subdominio origen de la redirección.
 * @property redirigido - Nombre del subdominio destino al que se redirige.
 */
export interface ISubdominioRedirigido {
    nombre: string;
    redirigido: string;
}

/**
 * Subdominio completamente resuelto: todos sus campos son obligatorios e inmutables.
 * Resultado de aplicar `Readonly<Required<ISubdominio>>`.
 */
export type ISubdominioCompleto = Readonly<Required<ISubdominio>>;

/**
 * Configuración de dominio utilizada para construir una instancia de {@link Dominio}.
 *
 * @property dominio    - Dominio raíz del sitio (p. ej. `"meteored.com"`).
 * @property subdominios - Configuración opcional de subdominios.
 *   @property subdominios.habilitados  - Lista de nombres de subdominio accesibles directamente.
 *     `"www"` siempre está habilitado aunque no se incluya.
 *   @property subdominios.listado      - Subdominios adicionales con su esquema. `""` (base) y `"www"`
 *     se incluyen automáticamente.
 *   @property subdominios.redirigidos  - Subdominios que deben redirigir a otro subdominio.
 *     Los subdominios del listado que no estén en `habilitados` se añaden aquí automáticamente
 *     apuntando a `"www"`.
 */
export interface IDominioConfig {
    dominio: string;
    subdominios?: {
        habilitados?: string[]; // www por defecto está habilitado
        listado?: ISubdominio[]; // base y www se sobreentienden
        redirigidos?: ISubdominioRedirigido[];
    };
}

/**
 * Gestiona la configuración de dominios y subdominios de un sitio, incluyendo
 * URLs absolutas, hosts, redirecciones y adaptación por entorno
 * (`PRODUCCION`, `TEST`, `DESARROLLO`).
 *
 * ### Subdominios automáticos
 * - El subdominio base (`""`) y `"www"` siempre se registran.
 * - Cualquier subdominio del listado que no esté en `habilitados` ni en `redirigidos`
 *   se redirige automáticamente a `"www"`.
 *
 * ### Adaptación por entorno
 * - **Desarrollo** — prefijo `"local-"` / `"local."` en hosts.
 * - **Test** — prefijo `"test-"` / `"test."` en hosts.
 * - **Producción / resto** — sin prefijo.
 */
export class Dominio {
    public static readonly BASE: ISubdominioCompleto = {
        nombre: "",
        scheme: "https",
    };
    public static readonly WWW: ISubdominioCompleto = {
        nombre: "www",
        scheme: "https",
    };

    protected readonly SUBDOMINIO_BASE: ISubdominioCompleto;
    protected readonly SUBDOMINIO_WWW: ISubdominioCompleto;

    public readonly BASE: string;
    public readonly WWW: string;

    public readonly nombre: string;
    public readonly cookies: string;
    public readonly defecto: string;
    public readonly defectoBase: string;
    public readonly dominio: string;
    private readonly dominios: Map<string, string>;
    private readonly hosts: Map<string, string>;
    private readonly redirecciones: Map<string, string>;

    protected constructor(config: IDominioConfig, {local="local", test="test"}: {local?: string, test?: string} = {}) {
        this.SUBDOMINIO_BASE = Dominio.BASE;
        this.SUBDOMINIO_WWW  = Dominio.WWW;
        this.BASE = this.SUBDOMINIO_BASE.nombre;
        this.WWW  = this.SUBDOMINIO_WWW.nombre;

        this.nombre       = `${config.dominio.charAt(0).toUpperCase()}${config.dominio.slice(1)}`;
        this.cookies      = `.${config.dominio}`;
        this.dominio      = config.dominio;
        this.dominios     = new Map<string, string>();
        this.hosts        = new Map<string, string>();
        this.redirecciones = new Map<string, string>();

        let coletillaGuion = "";
        let coletillaPunto = "";
        if (DESARROLLO) {
            coletillaGuion = `${local}-`;
            coletillaPunto = `${local}.`;
        } else if (TEST) {
            coletillaGuion = `${test}-`;
            coletillaPunto = `${test}.`;
        }

        const habilitados = [this.WWW, ...config.subdominios?.habilitados ?? []];
        const listado: ISubdominioCompleto[] = [this.SUBDOMINIO_BASE, this.SUBDOMINIO_WWW,
            ...config.subdominios?.listado?.map(subdominio => ({
                nombre: subdominio.nombre,
                scheme: subdominio.scheme ?? "https",
            })) ?? [],
        ];
        const redirigidos: ISubdominioRedirigido[] = [...(config.subdominios?.redirigidos ?? [])];

        this.defectoBase = `${coletillaGuion}${this.SUBDOMINIO_WWW.nombre}.${config.dominio}`;
        this.defecto     = `https://${this.defectoBase}`;

        for (const subdominio of listado) {
            if (subdominio.nombre.length > 0) {
                this.add(subdominio.nombre, `${subdominio.scheme}://${coletillaGuion}${subdominio.nombre}.${config.dominio}`);
            } else {
                this.add(subdominio.nombre, `${subdominio.scheme}://${coletillaPunto}${config.dominio}`);
            }

            // indexOf se usa por compatibilidad con navegadores que no implementan Array.prototype.includes.
            if (habilitados.indexOf(subdominio.nombre) === -1 && !redirigidos.find(r => r.nombre === subdominio.nombre)) {
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

    /**
     * Registra un subdominio con su URL absoluta y su host (sin esquema).
     * @param dominio - Nombre del subdominio.
     * @param url     - URL absoluta completa (p. ej. `"https://api.meteored.com"`).
     */
    protected add(dominio: string, url: string): void {
        this.dominios.set(dominio, url);
        this.hosts.set(dominio, url.split("://")[1]??url);
    }

    private addRedireccion(dominio: string, redireccion: string): void {
        this.redirecciones.set(dominio, redireccion);
    }

    /**
     * Devuelve la URL absoluta de un subdominio.
     * @param dominio - Nombre del subdominio. Si no existe, devuelve {@link defecto}.
     */
    public get(dominio: string): string {
        return this.dominios.get(dominio) ?? this.defecto;
    }

    /**
     * Devuelve el nombre del subdominio destino al que redirige el subdominio dado,
     * o `undefined` si no tiene redirección registrada.
     * @param dominio - Nombre del subdominio origen.
     */
    public getRedireccion(dominio: string): string|undefined {
        return this.redirecciones.get(dominio);
    }

    /**
     * Busca el nombre del subdominio cuya URL absoluta coincide con `host`.
     * Si no hay coincidencia devuelve `"www"`.
     * @param host - URL absoluta a buscar (p. ej. `"https://api.meteored.com"`).
     */
    public search(host: string): string {
        for (const [key, value] of this.dominios.entries()) {
            if (value===host) {
                return key;
            }
        }
        return this.WWW;
    }

    /**
     * Devuelve el host (sin esquema) de un subdominio.
     * @param dominio - Nombre del subdominio. Si no existe, devuelve {@link defectoBase}.
     */
    public host(dominio: string): string {
        return this.hosts.get(dominio) ?? this.defectoBase;
    }

    /**
     * Busca el nombre del subdominio cuyo host (sin esquema) coincide con `host`.
     * Si no hay coincidencia devuelve `"www"`.
     * @param host - Host a buscar (p. ej. `"api.meteored.com"`).
     */
    public searchHost(host: string): string {
        for (const [key, value] of this.hosts.entries()) {
            if (value===host) {
                return key;
            }
        }
        return this.WWW;
    }
}
