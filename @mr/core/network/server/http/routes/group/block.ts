/**
 * Editor: Bixus
 * Fecha: Thu, 06 Aug 2026 08:53:31 GMT
 * Hash: f3f763899c01b9f4587f86e852c5b9a3
 * Versión: 2026.8.6+1-bixus
 * Anterior: 2026.5.18+2-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-estaticos
 */

import type {IRouteGroupCache, NetCache} from "services-comun/modules/net/cache";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {error, warning} from "services-comun/modules/utiles/log";

import type {Checker, IExpresion} from "../../checkers";
import type {Conexion, TMetodo} from "../../conexion";
import type {Dominio} from "../../config/dominio";
import {Comodin} from "../../checkers/comodin";
import {Exact} from "../../checkers/exact";
import {Prefix} from "../../checkers/prefix";
import {Regex} from "../../checkers/regex";

/**
 * Métodos HTTP soportados para los que se mantiene un bucket en
 * {@link RouteGroupBlock.expresionesPorMetodo}. La indexación construye cada bucket
 * recorriendo {@link RouteGroupBlock.expresiones} en su orden original.
 */
const METODOS_INDEXADOS: readonly TMetodo[] = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];

/** Función manejadora de una ruta: recibe la conexión y los grupos capturados por el matcher. */
type THandler = (conexion: Conexion, url: string[]) => Promise<number>;

/** Función que actualiza la lista de expresiones de un bloque de rutas. */
type TUpdaterHandler = (bloque: RouteGroupBlock) => Promise<IExpresion[]>;

/**
 * Configuración del mecanismo de actualización dinámica de expresiones.
 *
 * @property interval - Intervalo en ms entre actualizaciones periódicas. `0` = solo una vez al arrancar.
 * @property exec     - Función que devuelve la nueva lista de expresiones.
 */
type TUpdater = {
    interval?: number;
    exec: TUpdaterHandler;
};

/**
 * Configuración de un bloque de rutas dentro de un {@link RouteGroup}.
 *
 * @property expresiones  - Lista de expresiones de enrutamiento que componen el bloque.
 * @property stop         - Si `true`, al hacer match se detiene la cadena de grupos (no se evalúan más grupos).
 * @property redireccion  - Dominio al que redirigir si el subdomain no está habilitado.
 * @property handler      - Función manejadora invocada cuando una expresión hace match.
 * @property updater      - Configuración para la actualización dinámica de expresiones.
 * @property cache        - Configuración parcial de caché para el bloque.
 * @property documentable - Si `false`, el bloque no aparece en la documentación generada. Por defecto `true`.
 * @property dominios      - Dominios por defecto para las expresiones del bloque. Se aplica a cada
 *   {@link IExpresion} de `expresiones` cuyo propio `dominios` no esté definido.
 */
export interface IRouteGroup {
    expresiones?: IExpresion[];
    stop?: boolean;
    redireccion?: Dominio;
    handler?: THandler;
    updater?: TUpdater;
    cache?: Partial<IRouteGroupCache>;
    documentable?: boolean;
    dominios?: string[];
}

/**
 * Configuración interna ya resuelta de un bloque de rutas.
 * Todos los campos son obligatorios: los opcionales se han resuelto con sus valores por defecto.
 */
interface IRouteGroupFinal {
    expresiones: Checker[];
    stop: boolean;
    redireccion?: Dominio;
    handler: THandler;
    updater?: TUpdater;
    cache: IRouteGroupCache;
    documentable: boolean;
    dominios?: string[];
}

/**
 * Bloque de rutas que agrupa una lista de expresiones de matching con su handler y
 * configuración de caché. Es la unidad mínima de enrutamiento dentro de un {@link RouteGroup}.
 *
 * ### Ciclo de vida
 * 1. Se construye vía {@link build} a partir de un {@link IRouteGroup}.
 * 2. Si tiene `updater`, carga las expresiones de forma asíncrona y las refresca periódicamente.
 * 3. El flag {@link ok} pasa a `true` cuando las expresiones están listas para recibir tráfico.
 * 4. En cada petición, {@link check} evalúa las expresiones en orden y delega al handler.
 */
export class RouteGroupBlock {

    /**
     * Construye e inicializa un nuevo bloque de rutas a partir de su configuración.
     * Si el bloque tiene `updater`, lo arranca inmediatamente.
     * @param data - Configuración del bloque.
     */
    public static build(data: IRouteGroup): RouteGroupBlock {
        data.handler ??= (conexion) => conexion.error(404, "No se ha definido manejador");
        const nuevo = new this({
            expresiones: this.parseExpresiones(data.expresiones ?? [], data.dominios),
            redireccion: data.redireccion,
            stop: data.stop ?? false,
            handler: data.handler,
            updater: data.updater,
            cache: data.cache === undefined ? {
                enabled: false,
                device: false,
            } : {
                enabled: false,
                device: false,
                ...data.cache,
            },
            documentable: data.documentable ?? true,
            dominios: data.dominios,
        });

        nuevo.initUpdater();

        return nuevo;
    }

    /**
     * Convierte una lista de {@link IExpresion} en instancias concretas de {@link Checker}.
     * Solo se instancia la primera estrategia de matching encontrada en cada expresión
     * (`regex` > `exact` > `prefix` > `comodin`).
     * @param expresiones     - Lista de configuraciones de expresión.
     * @param dominiosDefault - Dominios del {@link IRouteGroup} contenedor, aplicados a las
     *   expresiones que no definan su propio `dominios`.
     */
    private static parseExpresiones(expresiones: IExpresion[], dominiosDefault?: string[]): Checker[] {
        const salida: Checker[] = [];
        for (const expresionOriginal of expresiones) {
            // No mutamos `expresionOriginal` (podría ser una constante reutilizada por
            // varios bloques): si no define `dominios`, clonamos con el valor heredado
            // del `IRouteGroup` contenedor.
            const expresion = expresionOriginal.dominios === undefined && dominiosDefault !== undefined
                ? {...expresionOriginal, dominios: dominiosDefault}
                : expresionOriginal;

            // Aviso defensivo: solo se usa el primer matcher por prioridad
            // (regex > exact > prefix > comodin); cualquier otro definido se ignora.
            //
            // Excepción importante: cuando se define `regex`, el campo `prefix` NO se
            // considera un matcher alternativo sino un **guard rápido** que se evalúa
            // antes que la expresión regular para descartar URLs incompatibles sin
            // pagar el coste de la regex (ver `checkers/regex.ts`). Por eso esa
            // combinación concreta no genera warning.
            const matchers: string[] = [];
            if (expresion.regex !== undefined) {
                matchers.push("regex");
            }
            if (expresion.exact !== undefined) {
                matchers.push("exact");
            }
            if (expresion.prefix !== undefined && expresion.regex === undefined) {
                matchers.push("prefix");
            }
            if (expresion.comodin !== undefined) {
                matchers.push("comodin");
            }
            if (matchers.length > 1) {
                warning(
                    `Expresión '${expresion.resumen}' define varios matchers (${matchers.join(", ")}); ` +
                    `solo se usa '${matchers[0]}' por prioridad.`,
                );
            }

            if (expresion.regex !== undefined) {
                salida.push(new Regex(expresion, expresion.regex, expresion.prefix));
            } else if (expresion.exact !== undefined) {
                salida.push(new Exact(expresion, expresion.exact));
            } else if (expresion.prefix !== undefined) {
                salida.push(new Prefix(expresion, expresion.prefix));
            } else if (expresion.comodin !== undefined) {
                salida.push(new Comodin(expresion, expresion.comodin));
            } else {
                warning(
                    `Expresión '${expresion.resumen}' no define ningún matcher; será ignorada.`,
                );
            }
        }

        return salida;
    }

    /** `true` cuando las expresiones están cargadas y el bloque puede recibir tráfico. */
    public ok: boolean;

    /** Si `true`, al hacer match se detiene la evaluación del resto de grupos de la cadena. */
    public readonly stop: boolean;

    /** Si `true`, el bloque aparece en la documentación generada del servicio. */
    public readonly documentable: boolean;

    /** Dominio de redirección para subdominios no habilitados. */
    private readonly redireccion?: Dominio;

    /** Configuración de caché del bloque. */
    private readonly cache: IRouteGroupCache;

    /** Lista de expresiones de matching activa. Puede actualizarse dinámicamente. */
    private expresiones: Checker[];

    /**
     * Subconjuntos de {@link expresiones} indexados por método HTTP, preservando el
     * orden original. Para una petición con método `M` se itera
     * `expresionesPorMetodo.get(M)` en vez de toda la lista, ahorrando trabajo
     * cuando el bloque tiene rutas para varios métodos.
     */
    private expresionesPorMetodo: Map<TMetodo, Checker[]>;

    /** Handler original del bloque. */
    private readonly handler: THandler;

    /**
     * Handler efectivo: igual a {@link handler} si la caché está deshabilitada,
     * o a {@link handlerCache} si está habilitada.
     */
    private readonly prehandler: THandler;

    /** `true` mientras hay una actualización dinámica de expresiones en curso. */
    private updateando: boolean;

    /** Configuración del updater con `interval` resuelto a `0` si no se especificó. */
    private readonly updater?: Required<TUpdater>;

    /** Dominios por defecto del {@link IRouteGroup} contenedor, heredados por las expresiones del bloque. */
    private readonly dominiosDefault?: string[];

    private constructor(data: IRouteGroupFinal) {
        this.ok = false;
        this.stop = data.stop;
        this.redireccion = data.redireccion;
        this.cache = data.cache;
        this.expresiones = data.expresiones;
        this.expresionesPorMetodo = RouteGroupBlock.indexarPorMetodo(data.expresiones);
        this.handler = data.handler;
        this.prehandler = !this.cache.enabled
            ? this.handler
            : this.handlerCache;
        this.updateando = false;
        this.updater = data.updater === undefined
            ? undefined
            : { interval: 0, ...data.updater };
        this.documentable = data.documentable;
        this.dominiosDefault = data.dominios;
    }

    /**
     * Devuelve las expresiones del bloque que tienen `documentacion.enabled = true`.
     */
    public getDocumentables(): Checker[] {
        const salida: Checker[] = [];
        for (const actual of this.expresiones) {
            if (!actual.documentacion.enabled) {
                continue;
            }
            salida.push(actual);
        }

        return salida;
    }

    /**
     * Asigna el handler de caché si aún no se ha configurado.
     * @param cache - Instancia de caché de red.
     */
    public setCache(cache: NetCache): void {
        this.cache.handler ??= cache;
    }

    /**
     * Arranca el updater del bloque, si está configurado.
     * En la primera ejecución carga las expresiones de forma inmediata;
     * si `interval > 0`, programa actualizaciones periódicas adicionales.
     */
    private initUpdater(): void {
        if (this.updater !== undefined) {
            const fnc = this.updater.exec;
            this.updaterExec(fnc);
            if (this.updater.interval > 0) {
                setInterval(() => {
                    if (!this.updateando) {
                        this.updateando = true;
                        this.updaterExec(fnc);
                    }
                }, this.updater.interval);
            }
        } else {
            this.ok = true;
        }
    }

    /**
     * Ejecuta la función de actualización y aplica las nuevas expresiones.
     * Si falla, reintenta tras 1 segundo.
     * @param fnc - Función de actualización de expresiones.
     */
    private updaterExec(fnc: TUpdaterHandler): void {
        fnc(this).then((data) => {
            this.expresiones = RouteGroupBlock.parseExpresiones(data, this.dominiosDefault);
            this.expresionesPorMetodo = RouteGroupBlock.indexarPorMetodo(this.expresiones);
            this.ok = true;
            this.updateando = false;
        }).catch(async (err) => {
            error(`Error updateando HandlerBloque`, err);
            await PromiseDelayed(1000);
            this.updaterExec(fnc);
        });
    }

    /**
     * Construye el índice por método HTTP a partir de la lista ordenada de checkers.
     *
     * Para cada método registrado en {@link METODOS_INDEXADOS} se recorre `expresiones`
     * en orden y se incluyen los checkers cuyos métodos contienen el método objetivo
     * o que aceptan **todos** los métodos (`metodos.length === 0`).
     *
     * El orden relativo de los checkers dentro de cada bucket coincide con el orden
     * en `expresiones`, lo cual es **crítico** para preservar la semántica
     * "primer match gana" del router.
     */
    private static indexarPorMetodo(expresiones: Checker[]): Map<TMetodo, Checker[]> {
        const indice = new Map<TMetodo, Checker[]>();
        for (const metodo of METODOS_INDEXADOS) {
            const lista: Checker[] = [];
            for (const checker of expresiones) {
                if (checker.metodos.length === 0 || checker.metodos.includes(metodo)) {
                    lista.push(checker);
                }
            }
            indice.set(metodo, lista);
        }
        return indice;
    }

    /**
     * Handler intermedio que intenta servir la respuesta desde caché antes de
     * invocar al handler principal. Solo actúa en peticiones `GET`.
     * Si la caché falla, delega al handler y guarda la respuesta en background.
     * @param conexion     - Conexión HTTP activa.
     * @param coincidencias - Grupos capturados por el matcher de URL.
     */
    private async handlerCache(conexion: Conexion, coincidencias: string[]): Promise<number> {
        if (conexion.metodo !== "GET") {
            return this.handler(conexion, coincidencias);
        }

        if (this.cache.handler === undefined) {
            return this.handler(conexion, coincidencias);
        }

        try {
            return await this.cache.handler.check(conexion, this.cache);
        } catch {
            const salida = await this.handler(conexion, coincidencias);
            PromiseDelayed()
                .then(async () => {
                    await this.cache.handler!.save(conexion, this.cache).catch(() => undefined);
                });

            return salida;
        }
    }

    /**
     * Aplica redirección de subdominio si procede y delega al `prehandler`.
     * Captura cualquier excepción del handler y responde con un error 500,
     * registrando el error en el log solo la primera vez.
     * @param conexion      - Conexión HTTP activa.
     * @param coincidencias - Grupos capturados por el matcher de URL.
     */
    private async parseHandler(conexion: Conexion, coincidencias: string[]): Promise<void> {
        if (this.redireccion !== undefined) {
            const host = this.redireccion.getRedireccion(this.redireccion.searchHost(conexion.dominio));
            if (host !== undefined) {
                const dominio = this.redireccion.host(host);
                await conexion.send301(conexion.url.replace(conexion.dominio, dominio));
                return;
            }
        }

        try {
            await this.prehandler(conexion, coincidencias);
        } catch (err) {
            const stack = err instanceof Error ? err.stack : undefined;
            error("Error en Handler.check", conexion.url, err, stack);

            if (!conexion.isTerminado()) {
                const mensaje = err instanceof Error ? err.message : String(err);
                await conexion.error(500, mensaje)
                    .catch((catchErr) => {
                        error("Error en Handler.check (FATAL)", conexion.url, catchErr);
                    });
            }
        }
    }

    /**
     * Gestiona la respuesta CORS para peticiones `OPTIONS`, estableciendo los
     * headers de control de acceso y devolviendo una respuesta vacía.
     * @param conexion  - Conexión HTTP activa.
     * @param expresion - Expresión de la ruta que hizo match (contiene los métodos permitidos).
     */
    private async parseCors(conexion: Conexion, expresion: Checker): Promise<void> {
        conexion.enableCors();
        conexion.addCustomHeader("Access-Control-Allow-Credentials", "true");
        conexion.addCustomHeader("Access-Control-Allow-Methods", expresion.metodos.join(", "));
        conexion.addCustomHeader("Access-Control-Allow-Headers", "DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization,Referrer-Policy,x-api-key,x-datadog-origin");
        conexion.addCustomHeader("Access-Control-Max-Age", 1728000);
        conexion.setContentType("text/plain charset=UTF-8");
        await conexion
            .sendData(null)
            .catch(async (err) => {
                error("Error en Handler.check (OPTIONS)", conexion.url, err);
            });
    }

    /**
     * Evalúa las expresiones del bloque en orden y procesa la primera que hace match.
     *
     * - Si `stop` es `true`, devuelve `true` sin ejecutar el handler (la ruta existe pero no se sirve).
     * - Si el idioma tiene redirección configurada, redirige antes de invocar el handler.
     * - Las peticiones `OPTIONS` se procesan con {@link parseCors} en lugar del handler normal.
     *
     * @param conexion - Conexión HTTP activa.
     * @param metodo   - Método HTTP de la petición (precalculado fuera del bucle).
     * @returns `true` si alguna expresión hizo match (independientemente del resultado del handler),
     *   `false` si ninguna lo hizo.
     */
    public async check(conexion: Conexion, metodo: TMetodo): Promise<boolean> {
        // Iteramos el bucket indexado por método cuando existe; el orden dentro del
        // bucket coincide con el orden original de `expresiones`, lo cual es crítico
        // para preservar la semántica "primer match gana".
        const candidatos = this.expresionesPorMetodo.get(metodo) ?? this.expresiones;
        for (const expresion of candidatos) {
            const coincidencias = expresion.check({
                metodo,
                dominio: conexion.dominio,
                url: conexion.get,
                query: conexion.query,
                lang: conexion.idioma,
            });
            if (coincidencias !== null) {
                if (this.stop) {
                    return true;
                }
                conexion.preparando();
                // Etiquetar el span activo con el patrón de ruta para que Datadog
                // agrupe trazas por endpoint en lugar de por URL concreta.
                conexion.setRoute(expresion.resumen);

                if (expresion.lang.redir[conexion.idioma.idioma] !== undefined) {
                    await conexion
                        .redirect(
                            conexion.idioma.generar(
                                conexion.idioma.path,
                                expresion.lang.redir[conexion.idioma.idioma],
                            ),
                        )
                        .catch(async (err) => {
                            error("Error en Handler.check (LANG REDIR)", conexion.url, err);
                        });
                    return true;
                }

                if (conexion.metodo !== "OPTIONS") {
                    await this.parseHandler(conexion, coincidencias);
                } else {
                    await this.parseCors(conexion, expresion);
                }

                return true;
            }
        }

        return false;
    }

    /**
     * Recolecta los métodos HTTP aceptados para la URL/dominio/idioma/query de la
     * conexión, **ignorando el método HTTP** entrante. Lo usa el router para decidir
     * entre `405 Method Not Allowed` (URL existe con otro método) y `404 Not Found`.
     *
     * Itera la lista completa `expresiones` (no el índice por método) en su orden
     * original; los métodos encontrados se acumulan en el `Set` recibido por parámetro
     * para que el router pueda agregar resultados de varios bloques y grupos.
     */
    public collectAllowedMethods(conexion: Conexion, allowed: Set<TMetodo>): void {
        const data = {
            metodo: conexion.metodo,
            dominio: conexion.dominio,
            url: conexion.get,
            query: conexion.query,
            lang: conexion.idioma,
        };
        for (const expresion of this.expresiones) {
            const metodos = expresion.matchSinMetodo(data);
            if (metodos === null) {
                continue;
            }
            if (metodos.length === 0) {
                for (const m of METODOS_INDEXADOS) {
                    allowed.add(m);
                }
                continue;
            }
            for (const m of metodos) {
                allowed.add(m);
            }
        }
    }
}
