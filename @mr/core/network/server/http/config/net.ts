/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 11:19:03 GMT
 * Hash: 3ce498b1f5d929d205e2d44d9a12338b
 * Versión: 2026.5.18+3-josantoniojimnez
 * Anterior: 2026.5.18+2-josantoniojimnez
 */

/**
 * Par de puertos de escucha para los protocolos HTTP y HTTPS.
 *
 * @property http  - Puerto TCP para tráfico HTTP sin cifrar.
 * @property https - Puerto TCP para tráfico HTTPS (TLS).
 */
export interface INetPuertos {
    http: number;
    https: number;
}

/**
 * Implementación mutable de {@link INetPuertos} que fusiona valores por defecto
 * con sobreescrituras parciales del usuario.
 */
class NetPuertos implements INetPuertos {
    public readonly http: number;
    public readonly https: number;

    public constructor(defecto: INetPuertos, user: Partial<INetPuertos>) {
        this.http =  user.http??defecto.http;
        this.https = user.https??defecto.https;
    }
}

/**
 * Conjunto de endpoints (URLs base) para cada protocolo, con paths opcionales.
 *
 * @property http  - Lista de URLs base HTTP del servicio (p. ej. `["http://mi-servicio"]`).
 * @property https - Lista de URLs base HTTPS del servicio.
 * @property paths - Prefijos de ruta opcionales que se añaden a las URLs base.
 */
export interface INetEndpoints {
    http: string[];
    https: string[];
    paths?: string[];
}

/**
 * Implementación mutable de {@link INetEndpoints} que fusiona valores por defecto
 * con sobreescrituras parciales del usuario.
 */
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

/**
 * Configuración base de un servicio de red dentro del monorepo.
 *
 * @property endpoint       - Nombre DNS del servicio (sin esquema ni puerto).
 * @property alias          - Puerto alternativo opcional (legacy).
 * @property path           - Prefijo de ruta del servicio (p. ej. `"/api"`).
 * @property maxConnections - Límite de conexiones simultáneas permitidas.
 * @property maxFilesize    - Tamaño máximo de fichero aceptado en subidas (bytes). Por defecto 8 MB.
 * @property timeout        - Timeout de petición en milisegundos.
 * @property desarrollo     - URL completa de desarrollo que sobreescribe los valores de `http`/`https`
 *   (p. ej. `"http://localhost:3000"`). Cuando está presente, se extraen el host y el puerto de esta URL.
 * @property namespace      - Namespace de Kubernetes donde corre el servicio.
 *   Si se indica, la URL de producción incluye `.{namespace}.svc.cluster.local`.
 * @property tags           - Etiquetas de caché asociadas al servicio.
 * @property slow           - Umbral en ms a partir del cual una petición se considera lenta. Por defecto 1000 ms.
 */
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
    slow?: number;
}

/**
 * Configuración completa de un servicio de red: combina {@link INetServiceBase}
 * con los puertos HTTP/HTTPS definidos en {@link INetPuertos}.
 */
export interface INetService extends INetServiceBase, INetPuertos {
}

/**
 * Configuración de red resuelta de un servicio del monorepo.
 *
 * @property puertos        - Puertos de escucha HTTP y HTTPS.
 * @property endpoints      - URLs base y paths del servicio para cada protocolo.
 * @property maxConnections - Límite de conexiones simultáneas. `undefined` si no se acota.
 * @property timeout        - Timeout de petición en ms. `undefined` si no se acota.
 * @property compress       - Si `true`, el servidor aplica compresión (gzip/brotli/deflate) a las
 *                            respuestas con `sendDataCompress`/`sendHTML`/`sendRespuesta`. Por defecto
 *                            `false` y **debe permanecer así en producción**: CloudFlare comprime en
 *                            el edge y Envoy/ASM puede hacerlo en el sidecar, por lo que comprimir
 *                            también en Node solo gasta CPU del pod sin beneficio. El único caso de
 *                            uso legítimo es el proyecto `proxy` de desarrollo local (sin CloudFlare
 *                            ni ASM delante), donde sí hace falta comprimir en Node.
 * @property cacheTags      - Etiquetas de caché del servicio, usadas para invalidación selectiva.
 * @property uploadDir      - Directorio temporal donde se almacenan los ficheros subidos. Por defecto `"files/tmp"`.
 * @property maxFileSize    - Tamaño máximo de fichero aceptado en subidas (bytes). Por defecto 8 MB.
 * @property slow           - Umbral de petición lenta en ms. Por defecto 1000 ms.
 */
export interface INet {
    puertos: INetPuertos;
    endpoints: INetEndpoints;
    maxConnections?: number;
    timeout?: number;
    compress: boolean;
    cacheTags: string[];
    uploadDir: string;
    maxFileSize: number;
    slow: number;
    /** Tamaño máximo en bytes del cuerpo de una petición HTTP (POST/PUT/PATCH/DELETE). Por defecto 10 MB. */
    maxRequestBodySize: number;
    /**
     * Si `true`, el servidor confía en las cabeceras `X-Forwarded-*` y `X-Real-IP` para
     * resolver IP cliente, host y protocolo. En producción detrás de Istio/ASM debe ser `true`.
     * Por defecto: `PRODUCCION`.
     */
    trustProxy: boolean;
    /**
     * Timeout en ms para conexiones keep-alive. Debe ser mayor que el `keepalive` del
     * proxy upstream (típicamente 60 s en Envoy) para evitar cerrar el TCP cuando el
     * proxy lo está reutilizando. Por defecto `75_000`.
     */
    keepAliveTimeout: number;
    /**
     * Timeout en ms para recibir las cabeceras de una petición. Debe ser mayor que
     * {@link keepAliveTimeout} para evitar 408 espurios. Por defecto `80_000`.
     */
    headersTimeout: number;
    /**
     * Tiempo máximo en ms que el servidor espera a drenar conexiones tras recibir
     * `SIGTERM`/`SIGINT` antes de cerrar forzosamente. Por defecto `25_000`.
     */
    shutdownTimeout: number;
}

/**
 * Configuración de red resuelta a partir de una configuración por defecto y
 * sobreescrituras parciales del usuario. Adapta automáticamente los endpoints
 * según el entorno (`PRODUCCION`, desarrollo local o URL de desarrollo personalizada).
 *
 * ### Resolución de endpoints por entorno
 * - **Producción** — usa el nombre DNS de Kubernetes como host; el puerto HTTP
 *   se lee de la variable de entorno `PORT` (por defecto 8080).
 * - **Desarrollo con `cfg.desarrollo`** — extrae el host y el puerto de la URL
 *   proporcionada y la usa como endpoint tanto para HTTP como para HTTPS.
 * - **Desarrollo sin `cfg.desarrollo`** — usa `localhost` con los puertos declarados
 *   en `cfg.http` / `cfg.https`.
 */
export class Net implements INet {

    /**
     * Construye una configuración {@link INet} a partir de la descripción de un servicio,
     * adaptando los puertos y endpoints al entorno de ejecución actual.
     *
     * @param cfg - Descripción del servicio (nombre DNS, puertos, tags, etc.).
     * @returns Configuración de red lista para usar como `defecto` en el constructor de {@link Net}.
     */
    public static buildDefault(cfg: INetService): INet {
        const comun = {
            maxConnections: cfg.maxConnections,
            cacheTags: [...cfg.tags],
            compress: false,
            uploadDir: "files/tmp",
            maxFileSize: cfg.maxFilesize ?? 8 * 1024 * 1024, // 8MB
            slow: cfg.slow ?? 1000,
            maxRequestBodySize: 10 * 1024 * 1024, // 10MB
            trustProxy: global.PRODUCCION,
            keepAliveTimeout: 75_000,
            headersTimeout: 80_000,
            // En producción interesa un drenado generoso para terminar peticiones largas;
            // en desarrollo (mrpack reiniciando) preferimos cierres casi instantáneos.
            shutdownTimeout: global.PRODUCCION ? 25_000 : 2_000,
        };

        if (global.PRODUCCION) {
            // noinspection HttpUrlsUsage
            return {
                ...comun,
                puertos: {
                    http: process.env["PORT"]?
                        parseInt(process.env["PORT"]!, 10):
                        8080,
                    https: 4433,
                    // grpc: 50050,
                },
                endpoints: {
                    http: [`http://${cfg.endpoint}${cfg.namespace?`.${cfg.namespace}.svc.cluster.local`:""}`],
                    https: [`https://${cfg.endpoint}${cfg.namespace?`.${cfg.namespace}.svc.cluster.local`:""}`],
                    paths: cfg.path ? [cfg.path] : undefined,
                },
            };
        }

        if (!cfg.desarrollo) {
            return {
                ...comun,
                puertos: {
                    http: cfg.http,
                    https: cfg.https,
                },
                endpoints: {
                    http: [`http://localhost${cfg.http!==80?`:${cfg.http}`:""}`],
                    https: [`https://localhost${cfg.https!==443?`:${cfg.https}`:""}`],
                    paths: cfg.path!==undefined ? [cfg.path] : undefined,
                },
            };
        }

        const url = new URL(cfg.desarrollo);
        const puerto = parseInt(url.port, 10);

        return {
            ...comun,
            puertos: {
                http: puerto,
                https: puerto,
            },
            endpoints: {
                http: [cfg.desarrollo],
                https: [cfg.desarrollo],
                paths: cfg.path ? [cfg.path] : undefined,
            },
        };

    }

    public readonly puertos: NetPuertos;
    public readonly endpoints: NetEndpoints;
    public readonly maxConnections?: number;
    public readonly timeout?: number;
    public readonly compress: boolean;
    public readonly cacheTags: string[];
    public readonly uploadDir: string;
    public readonly maxFileSize: number;
    public readonly slow: number;
    public readonly maxRequestBodySize: number;
    public readonly trustProxy: boolean;
    public readonly keepAliveTimeout: number;
    public readonly headersTimeout: number;
    public readonly shutdownTimeout: number;

    public constructor(defecto: INet, user: Partial<INet>) {
        this.puertos   = new NetPuertos(defecto.puertos, user.puertos??{});
        this.endpoints = new NetEndpoints(defecto.endpoints, user.endpoints??{});
        this.maxConnections = user.maxConnections??defecto.maxConnections;
        this.timeout = user.timeout??defecto.timeout;
        this.compress  = user.compress??defecto.compress;
        this.cacheTags = user.cacheTags??defecto.cacheTags;
        this.uploadDir = user.uploadDir??defecto.uploadDir;
        this.maxFileSize = user.maxFileSize??defecto.maxFileSize;
        this.slow = user.slow??defecto.slow;
        this.maxRequestBodySize = user.maxRequestBodySize??defecto.maxRequestBodySize;
        this.trustProxy = user.trustProxy??defecto.trustProxy;
        this.keepAliveTimeout = user.keepAliveTimeout??defecto.keepAliveTimeout;
        this.headersTimeout = user.headersTimeout??defecto.headersTimeout;
        this.shutdownTimeout = user.shutdownTimeout??defecto.shutdownTimeout;
    }
}
