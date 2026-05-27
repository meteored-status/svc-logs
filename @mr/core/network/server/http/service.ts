import {ConfigService} from "services-comun/modules/services/config";
import {md5} from "services-comun/modules/utiles/hash";

import {type INet, type INetService, type INetServiceBase, Net} from "./config/net";

/**
 * Opciones de construcción del {@link Service}.
 *
 * @property prefix  - Prefijo adicional que se incorpora al cálculo determinista del puerto.
 *                     Permite que dos servicios con el mismo endpoint obtengan puertos distintos.
 * @property builder - Función que, dado el ID numérico de un servicio, devuelve la clave de cadena
 *                     con la que se podrá resolver ese servicio mediante {@link Service.configuracion}.
 */
interface IServiceConfig {
    prefix?: string;
    builder?: (id: number) => string;
}

/**
 * Registro central de servicios de red del monorepo.
 *
 * Mantiene un mapa de servicios identificados por un ID numérico y calcula
 * determinísticamente el par de puertos HTTP/HTTPS de cada uno mediante el
 * hash MD5 de su nombre DNS, namespace y prefijo configurado.
 *
 * Soporta **alias**: un servicio puede delegar sus puertos en otro ya registrado.
 * Si se detecta un ciclo de alias, se lanza un error para evitar una recursión infinita.
 *
 * ### Uso básico
 * ```ts
 * const service = new Service(mapaServicios, { prefix: "api" });
 * const net = service.configuracion(42);          // por ID numérico
 * const net2 = service.configuracion("mi-svc");  // por nombre (requiere builder)
 * const cfg = service.servicio(42);              // → ConfigService listo para usar
 * ```
 */
export class Service {

    /** Puerto HTTP base desde el que se asignan los puertos dinámicos. */
    private static readonly PUERTO_HTTP = 8100;

    /** Puerto HTTPS base desde el que se asignan los puertos dinámicos. */
    private static readonly PUERTO_HTTPS = 4433;


    /** Caché de puertos ya calculados, indexada por ID de servicio. */
    private readonly ports: Map<number, number>;

    /** Mapa de nombre de cadena → ID numérico, poblado por el `builder`. */
    private readonly services: Map<string, number>;

    /** Prefijo adicional para el cálculo determinista del puerto. */
    private readonly prefix: string;

    public constructor(private readonly map: Map<number, INetServiceBase>, {prefix = "", builder}: IServiceConfig) {
        map.forEach((service) => {
            service.namespace ??= process.env["CLIENTE"];
        });
        this.ports = new Map<number, number>();
        this.services = new Map<string, number>();
        this.prefix = prefix;
        if (builder) {
            for (const id of map.keys()) {
                this.services.set(builder(id), id);
            }
        }
    }

    /**
     * Resuelve la configuración de red de un servicio dado su ID numérico,
     * incluyendo los puertos HTTP/HTTPS calculados o heredados por alias.
     *
     * @param servicio - ID numérico del servicio.
     * @param visited  - Conjunto de IDs visitados en la recursión de alias (guard anti-ciclo).
     * @returns Configuración de red completa del servicio.
     * @throws {Error} Si el alias forma un ciclo o si el ID no existe en el mapa.
     */
    private get(servicio: number, visited: Set<number> = new Set<number>()): INetService {
        if (visited.has(servicio)) {
            throw new Error(`Ciclo de alias detectado en el servicio ${servicio}`);
        }
        visited.add(servicio);

        const data = this.map.get(servicio) ?? {
            endpoint: "localhost",
            tags: [],
        };

        if (!data.alias) {
            if (!this.ports.has(servicio)) {
                const sufijo = this.prefix.length > 0 ? `/${this.prefix}` : "";
                const hash = md5(`${data.endpoint}.${data.namespace ?? "default"}.svc.cluster.local${sufijo}`);
                const base = parseInt(hash.slice(0, 8), 16) % (32768 - Service.PUERTO_HTTP);
                this.ports.set(servicio, base);
            }
            const base = this.ports.get(servicio)!;
            return {
                ...data,
                http: Service.PUERTO_HTTP + base,
                https: Service.PUERTO_HTTPS + base,
            };
        }

        const padre = this.get(data.alias, visited);
        return {
            ...data,
            http: padre.http,
            https: padre.https,
        };
    }

    /**
     * Devuelve la configuración de red resuelta para un servicio.
     *
     * Acepta el ID numérico del servicio o, si se proporcionó un `builder` en el
     * constructor, la clave de cadena generada por dicho builder.
     *
     * @param servicio - ID numérico o nombre de cadena del servicio.
     * @returns Configuración {@link INet} lista para usar.
     * @throws {Error} Si el nombre de cadena no se encuentra en el registro.
     */
    public configuracion(servicio: number): INet;
    public configuracion(servicio: string): INet;
    public configuracion(servicio: string | number): INet {
        if (typeof servicio === "string") {
            const id = this.services.get(servicio);
            if (id === undefined) {
                throw new Error(`Servicio ${servicio} no encontrado`);
            }
            servicio = id;
        }
        return Net.buildDefault(this.get(servicio));
    }

    /**
     * Construye un {@link ConfigService} listo para usar a partir del ID numérico del servicio.
     *
     * @param servicio - ID numérico del servicio.
     * @returns Instancia de {@link ConfigService} configurada.
     */
    public servicio(servicio: number): ConfigService {
        return ConfigService.build(this.configuracion(servicio));
    }
}
