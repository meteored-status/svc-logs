/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 10:42:05 GMT
 * Hash: 08432203ebd250aeb755cd0f644c9e84
 * Versión: 2026.5.18+2-josantoniojimnez
 */

import {URLSearchParams} from "node:url";

import type {Idioma} from "../i18n";
import type {IQuery, Query} from "./query";
import type {TMetodo} from "../conexion";
import {Regex} from "./query/regex";
import {Exact} from "./query/exact";
import {Prefix} from "./query/prefix";
import {Options} from "./query/options";
import {Cualquiera} from "./query/cualquiera";
import {CustomSpecification} from "../schema/spec";

/**
 * Configuración de visibilidad en la documentación generada del servicio.
 *
 * @property enabled     - Si `true`, la ruta aparece en la documentación pública.
 * @property descripcion - Descripción libre que se incluye en la documentación.
 */
export interface IDocumentable {
    enabled: boolean;
    descripcion?: string;
}

/**
 * Restricciones de idioma aplicadas a una expresión.
 *
 * @property include - Lista blanca de idiomas permitidos. Si se omite, se permiten todos.
 * @property exclude - Lista de idiomas excluidos explícitamente.
 * @property redir   - Mapa de redirecciones por idioma (`idioma → URL destino`).
 */
interface IExpresionLang {
    include?: string[];
    exclude: string[];
    redir: Record<string, string>;
}

/**
 * Configuración de una expresión de enrutamiento HTTP.
 *
 * ### Matcher de URL (elige uno)
 * Al menos uno de `regex`, `exact`, `prefix` o `comodin` debe estar presente;
 * si ninguno se indica, la expresión se ignora.
 *
 * @property metodos       - Métodos HTTP aceptados. `"ALL"` o array vacío = todos.
 *   Se añaden `OPTIONS` (para rutas `/web/`) y `HEAD` automáticamente.
 * @property dominios      - Dominios a los que aplica la expresión. Vacío = todos.
 * @property regex         - Expresión regular para hacer matching por URL.
 * @property exact         - URL exacta que debe coincidir.
 * @property prefix        - Prefijo con el que debe comenzar la URL.
 * @property comodin       - Si `true`, acepta cualquier URL.
 * @property resumen       - Identificador/descripción corta de la ruta (usado también en logs).
 * @property checkQuery    - Si `true` (por defecto cuando `query` está definido), valida los parámetros de query.
 * @property query         - Mapa de validadores de parámetros de query string.
 * @property lang          - Restricciones de idioma.
 * @property post          - Especificación del cuerpo de la petición (para documentación/validación).
 * @property response      - Especificación del cuerpo de la respuesta.
 * @property headers       - Especificación de headers requeridos.
 * @property log           - Si `false`, deshabilita el log de esta ruta. Por defecto `true`.
 * @property internal      - Si `true`, la ruta es de uso interno (no expuesta al exterior). Por defecto `false`.
 * @property deprecated    - Si `true`, la ruta está marcada como obsoleta. Por defecto `false`.
 * @property documentacion - Configuración de visibilidad en la documentación generada.
 */
export interface IExpresion {
    metodos?: TMetodo[];
    dominios?: string[];
    regex?: RegExp;
    exact?: string;
    prefix?: string;
    comodin?: boolean;
    resumen: string;
    checkQuery?: boolean;
    query?: Record<string, IQuery>;
    lang?: Partial<IExpresionLang>;
    post?: CustomSpecification;
    response?: CustomSpecification;
    headers?: CustomSpecification;
    log?: boolean;
    internal?: boolean;
    deprecated?: boolean;
    documentacion?: Partial<IDocumentable>;
}

/**
 * Expresión de enrutamiento dinámico con datos asociados a la coincidencia.
 *
 * @template T - Tipo del dato asociado al match.
 * @property exact    - URL exacta que debe coincidir.
 * @property dominios - Dominios a los que aplica. Vacío = todos.
 * @property data     - Dato arbitrario devuelto junto con el match.
 */
export interface IExpresionDynamic<T> {
    exact: string;
    dominios?: string[];
    data: T;
}

/**
 * Datos de entrada que se evalúan en cada petición HTTP entrante.
 *
 * @property dominio - Dominio de la petición.
 * @property metodo  - Método HTTP de la petición.
 * @property url     - Path de la URL (sin query string).
 * @property query   - Parámetros de query string.
 * @property lang    - Idioma resuelto de la petición.
 */
interface ICheckerData {
    dominio: string;
    metodo: TMetodo;
    url: string;
    query: URLSearchParams;
    lang: Idioma;
}

/**
 * Función optimizada de comprobación de método y dominio, generada en el constructor
 * según la combinación concreta de métodos y dominios configurados.
 */
type TCheckFunction = (check: ICheckerData) => boolean;

/**
 * Clase base abstracta para las expresiones de enrutamiento HTTP.
 *
 * Cada subclase implementa {@link checkEjecutar} con su lógica de matching de URL
 * (`Regex`, `Exact`, `Prefix`, `Comodin`). Esta clase se encarga del resto:
 * filtrado por método/dominio, validación de idioma, validación de query params
 * y auto-adición de `OPTIONS`/`HEAD`.
 *
 * ### Optimización de método/dominio
 * La `checkFunction` se elige en el constructor según la combinación de
 * `allMethods` × `allDomains`, evitando condiciones redundantes en cada request.
 */
export abstract class Checker {

    /** Métodos HTTP aceptados. Array vacío indica que se aceptan todos. */
    public readonly metodos: TMetodo[];

    /** Dominios aceptados. Array vacío indica que se aceptan todos. */
    public readonly dominios: string[];

    /** Identificador/descripción corta de la ruta. */
    public readonly resumen: string;

    /** Si `true`, los accesos a esta ruta se registran en el log. */
    public readonly log: boolean;

    /** Si `true`, la ruta es de uso interno y no se expone hacia el exterior. */
    public readonly internal: boolean;

    /** Si `true`, la ruta está marcada como obsoleta. */
    public readonly deprecated: boolean;

    /** Restricciones de idioma aplicadas tras el matching de URL. */
    public readonly lang: IExpresionLang;

    /** Configuración de visibilidad en la documentación generada. */
    public readonly documentacion: IDocumentable;

    /** Si `true`, se validan los parámetros de query string en cada petición. */
    private readonly checkQuery: boolean;

    /** Lista de validadores de parámetros de query string. */
    private readonly query: Query[];

    /**
     * Función de comprobación de método/dominio generada en el constructor.
     * Evita ramificaciones en cada request seleccionando la variante más simple
     * según la combinación de métodos y dominios configurados.
     */
    private readonly checkFunction: TCheckFunction;

    protected constructor(obj: IExpresion) {
        // Clonamos los arrays para no mutar el `IExpresion` recibido (podría ser una
        // constante reutilizada por varios bloques de rutas; mutarlo provocaría sumas
        // de `OPTIONS`/`HEAD` repetidas en cada instanciación).
        const metodosInput: TMetodo[] = obj.metodos === undefined ? [] : [...obj.metodos];
        this.dominios = obj.dominios === undefined ? [] : [...obj.dominios];
        this.resumen = obj.resumen;
        this.log = obj.log ?? true;
        this.internal = obj.internal ?? false;
        this.deprecated = obj.deprecated ?? false;
        this.query = [];
        this.lang = {
            exclude: [],
            redir: {},
            ...obj.lang ?? {},
        };

        let allMethods: boolean;
        if (metodosInput.length === 0 || metodosInput.includes("ALL")) {
            this.metodos = [];
            allMethods = true;
        } else {
            if (this.resumen.startsWith("/web/") && !metodosInput.includes("OPTIONS")) {
                metodosInput.push("OPTIONS");
            }
            if (!metodosInput.includes("HEAD")) {
                metodosInput.push("HEAD");
            }
            this.metodos = metodosInput;
            allMethods = false;
        }

        const allDomains = this.dominios.length === 0;

        if (allMethods) {
            if (allDomains) {
                this.checkFunction = () => true;
            } else {
                this.checkFunction = ({dominio}: ICheckerData) => this.dominios.includes(dominio);
            }
        } else if (allDomains) {
            this.checkFunction = ({metodo}: ICheckerData) => this.metodos.includes(metodo);
        } else {
            this.checkFunction = ({dominio, metodo}: ICheckerData) => this.dominios.includes(dominio) && this.metodos.includes(metodo);
        }

        if (obj.query !== undefined) {
            this.checkQuery = obj.checkQuery ?? true;
            for (const key of Object.keys(obj.query)) {
                const actual = obj.query[key] as IQuery;
                if (actual.regex !== undefined) {
                    this.query.push(new Regex(key, actual, actual.regex));
                } else if (actual.exact !== undefined) {
                    this.query.push(new Exact(key, actual, actual.exact));
                } else if (actual.prefix !== undefined) {
                    this.query.push(new Prefix(key, actual, actual.prefix));
                } else if (actual.options !== undefined) {
                    this.query.push(new Options(key, actual, actual.options));
                } else if (actual.cualquiera !== undefined) {
                    this.query.push(new Cualquiera(key, actual, actual.cualquiera));
                }
            }
        } else {
            this.checkQuery = false;
        }

        this.documentacion = {
            enabled: false,
            ...obj.documentacion ?? {},
        };
    }

    /**
     * Evalúa si la petición entrante satisface todos los criterios de esta expresión.
     *
     * El proceso de evaluación sigue este orden, cortocircuitando en el primer fallo:
     * 1. Método HTTP y dominio (vía `checkFunction`).
     * 2. Matching de URL (vía {@link checkEjecutar}).
     * 3. Restricciones de idioma (`lang.include` / `lang.exclude`).
     * 4. Validación de query params (si `checkQuery` es `true`).
     *
     * @param checkerData - Datos de la petición a evaluar.
     * @returns Array de grupos capturados por el matcher, o `null` si no hay coincidencia.
     *   Para matchers sin grupos (p. ej. `Exact`) se devuelve `[]`.
     */
    public check(checkerData: ICheckerData): string[] | null {
        if (!this.checkFunction(checkerData)) {
            return null;
        }

        const coincidencias = this.checkEjecutar(checkerData.url);
        if (!coincidencias) {
            return null;
        }

        if (this.lang.include !== undefined && !this.lang.include.includes(checkerData.lang.idioma)) {
            return null;
        }
        if (this.lang.exclude.includes(checkerData.lang.idioma)) {
            return null;
        }
        if (this.checkQuery) {
            for (const query of this.query) {
                if (!query.check(checkerData.query.getAll(query.key))) {
                    if (!query.opcional) {
                        return null;
                    }
                }
            }
        }

        return coincidencias;
    }

    /**
     * Misma lógica de matching que {@link check} pero **ignorando el método HTTP**.
     *
     * Se usa exclusivamente cuando ningún checker hizo match con el método entrante
     * para decidir si la respuesta debe ser `405 Method Not Allowed` (URL existe pero
     * con otro método) o `404 Not Found` (URL realmente desconocida).
     *
     * @returns La lista de métodos que esta expresión acepta para el resto de criterios
     *   (URL, dominio, idioma, query). Devuelve `[]` cuando acepta **todos** los métodos.
     *   `null` si el resto de criterios no coinciden (en cuyo caso esta expresión no aporta
     *   nada al cálculo del `Allow`).
     */
    public matchSinMetodo(checkerData: ICheckerData): TMetodo[] | null {
        if (this.dominios.length > 0 && !this.dominios.includes(checkerData.dominio)) {
            return null;
        }
        if (!this.checkEjecutar(checkerData.url)) {
            return null;
        }
        if (this.lang.include !== undefined && !this.lang.include.includes(checkerData.lang.idioma)) {
            return null;
        }
        if (this.lang.exclude.includes(checkerData.lang.idioma)) {
            return null;
        }
        if (this.checkQuery) {
            for (const query of this.query) {
                if (!query.check(checkerData.query.getAll(query.key)) && !query.opcional) {
                    return null;
                }
            }
        }
        return this.metodos.slice();
    }
    /**
     * Hook de actualización invocado cuando la expresión necesita refrescarse
     * (p. ej. actualización de datos en caliente). Las subclases pueden sobreescribir
     * este método para reaccionar al evento.
     */
    public update(): void {
        // updater de expresiones
    }

    /**
     * Comprueba si la URL proporcionada satisface el criterio de matching de la subclase.
     * @param url - Path de la URL a evaluar (sin query string).
     * @returns Array de grupos capturados (vacío si no hay grupos), o `null` si no hay coincidencia.
     */
    protected abstract checkEjecutar(url: string): string[] | null;
}
