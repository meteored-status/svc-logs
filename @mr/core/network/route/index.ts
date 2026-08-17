/**
 * Editor: miguel
 * Fecha: Mon, 20 Jul 2026 11:26:48 GMT
 * Hash: 298d4288b1a4303bd82005129f7b8f00
 * Versión: 2026.7.20+1-miguel
 * Anterior: 2026.6.17+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-web-www.git
 */

import {type Configuracion} from "@mr/core-workload/config";
import type {Idioma} from "@mr/core-i18n/langs";
import {error} from "services-comun/modules/utiles/log";

import type {Conexion} from "../server/http/conexion";
import type {Dominio} from "../server/http/config/dominio";
import type {Idioma as IdiomaNet} from "../server/http/i18n";
import type {IExpresion} from "../server/http/checkers";
import type {TDevice} from "../server/http/config/device";
import type {IncomingHttpHeaders} from "node:http";

interface IConfig {
    dominio: Dominio;
    idiomas: Idioma[];
}

interface IRouteURL {
    defecto: string;
    lang?: Partial<Record<Idioma, string>>;
}

/**
 * Descriptor plano con el que se instancia una {@link Route}.
 *
 * @property nombre        - Identificador único de la ruta.
 * @property expresiones   - Reglas de routing (dominio, método HTTP, idioma, patrón de URL).
 *                           Si se omite, la ruta no tiene expresiones de matching propias.
 * @property idiomas       - Idiomas soportados. Si se omite, hereda todos los idiomas del dominio.
 * @property idiomaDefecto - Idioma por defecto. Si se omite, se usa `"en"` o el primer idioma disponible.
 * @property url           - Configuración de URLs: patrón base y patrones alternativos por idioma.
 */
export interface IRoute {
    nombre: string;
    expresiones?: IExpresion[];
    idiomas?: Idioma[];
    idiomaDefecto?: Idioma;
    url: IRouteURL;
}

/**
 * Opciones para {@link Route.run}.
 *
 * @property checkLang - Si `true` (por defecto), verifica que el idioma de la petición esté
 *                       entre los soportados por la ruta antes de ejecutar el runner.
 * @property params    - Parámetros de URL. Si es un array, se mapean posicionalmente a los
 *                       nombres declarados en `url.defecto` (e.g. `["/es/madrid"]` →
 *                       `{ciudad: "madrid"}`). Si es un objeto, se usa directamente.
 */
export interface IRouteOptions {
    checkLang?: boolean;
    params?: Record<string, string|undefined> | string[];
}

/**
 * Contexto de petición que recibe el runner en {@link Route.run}.
 *
 * @property lang    - Idioma activo de la petición.
 * @property dominio - Valor de `request.headers.host` de la petición entrante.
 * @property url     - URL completa de la petición.
 * @property device  - Tipo de dispositivo detectado (`pc` / `mv`).
 * @property section - Instancia de la ruta que está procesando la petición.
 * @property params  - Parámetros de URL extraídos y normalizados como mapa clave→valor.
 */
export interface IRouteBuilderOptions {
    lang: IdiomaNet;
    dominio: string;
    url: string;
    device: TDevice;
    section: Route;
    headers: IncomingHttpHeaders;
    params: Record<string, string|undefined>;
}

/**
 * Función de handler que ejecuta la lógica de negocio de una ruta.
 *
 * @template C - Tipo de la configuración de la aplicación.
 * @template T - Tipo del valor devuelto por el handler.
 * @param config  - Configuración de la aplicación.
 * @param options - Contexto de petición construido por {@link Route.run}.
 */
export type TRouteRunner<C extends Configuracion, T> = (config: C, options: IRouteBuilderOptions)=>Promise<T>;

/**
 * Mapa de parámetros extraídos de la URL.
 * Las claves son los nombres declarados en el patrón de URL (e.g. `{ciudad}`)
 * y los valores son los segmentos correspondientes de la URL real.
 */
export type TParams = Partial<Record<string, string>>;

interface IUrlOptions {
    subdominio?: string,
    idioma?: Idioma;
    params?: TParams;
}

/**
 * Modela una ruta de la aplicación: agrupa la configuración de URLs por idioma,
 * las expresiones de routing y la lógica de ejecución de handlers de petición.
 *
 * Se construye directamente con `new Route(cfg, route)` o mediante la función
 * de conveniencia `crearExactGET` (en `factory/exact/get`) para rutas de URL exacta con método GET.
 */
export class Route {
    /* INSTANCE */
    private readonly dominio: string;

    public readonly nombre: string;
    public readonly expresiones: IExpresion[];
    public readonly idiomas: Idioma[];
    public readonly idiomaDefecto: Idioma;

    protected readonly urls: Partial<Record<Idioma, string>>;
    protected readonly urlDefault: string;
    protected readonly params: string[];
    protected readonly paramsLength: number;

    public constructor(private readonly cfg: IConfig, seccion: IRoute) {
        this.dominio = cfg.dominio.get(cfg.dominio.WWW);
        this.nombre = seccion.nombre;
        this.expresiones = seccion.expresiones ?? [];
        this.idiomas = seccion.idiomas ?? this.cfg.idiomas.slice();
        this.idiomaDefecto = seccion.idiomaDefecto ?? (this.idiomas.includes("en") ? "en" : (this.idiomas[0] ?? "en"));
        this.urlDefault = seccion.url.defecto;
        this.urls = seccion.url.lang ?? {};
        const matches = this.urlDefault.match(/\{([^}]+)}/g);
        this.params = matches ? matches.map(m => m.slice(1, -1)) : [];
        this.paramsLength = this.params.length;
    }

    /**
     * Comprueba si el idioma de la petición está entre los soportados por la ruta.
     *
     * @param lang - Idioma activo de la petición.
     * @returns `true` si el idioma está soportado.
     */
    public checkLang(lang: IdiomaNet): boolean {
        return this.idiomas.includes(lang.idioma);
    }

    /**
     * Devuelve el patrón de URL para el idioma dado, sustituyendo los parámetros
     * `{nombre}` por sus valores si se proporcionan.
     * El resultado sin parámetros se cachea por idioma en {@link urls}.
     *
     * @param lang   - Idioma para el que se quiere el path.
     * @param params - Valores de sustitución. Si se omite, devuelve el patrón sin sustituir.
     * @returns Path de la ruta con los parámetros resueltos.
     */
    public getPath(lang: Idioma, params?: TParams): string {
        if (!params) {
            return this.urls[lang] ??= this.urlDefault;
        }

        let salida = this.urls[lang] ?? this.urlDefault;
        for (const [key, value] of Object.entries(params)) {
            salida = salida.replaceAll(`{${key}}`, `${value}`);
        }

        return salida;
    }

    /**
     * Genera el path traducido al idioma indicado aplicando el prefijo de idioma
     * si es necesario (delega en {@link IdiomaNet.generar}).
     *
     * @param lang   - Objeto de idioma de la petición.
     * @param idioma - Idioma destino del path.
     * @param params - Parámetros de sustitución opcionales.
     * @returns Path con prefijo de idioma aplicado.
     */
    protected getTranslatedPath(lang: IdiomaNet, idioma: Idioma, params?: TParams): string {
        return lang.generar(this.getPath(idioma, params), idioma);
    }

    /**
     * Devuelve la URL absoluta completa (dominio + path traducido).
     *
     * @param lang - Objeto de idioma de la petición; determina también el idioma por defecto del path.
     * @param opts - Opciones opcionales: `idioma` alternativo, `params` de sustitución y `subdominio`.
     * @returns URL absoluta, e.g. `"https://www.meteored.com/es/tiempo/madrid"`.
     */
    public getURL(lang: IdiomaNet, {idioma=lang.idioma, params, subdominio}: IUrlOptions={}): string {
        return `${!subdominio ? this.dominio : this.cfg.dominio.get(subdominio)}${this.getTranslatedPath(lang, idioma, params)}`;
    }

    /**
     * Convierte un array de valores posicionales en un mapa clave→valor
     * usando los nombres de parámetro declarados en el patrón de URL.
     *
     * @param values - Valores posicionales extraídos de la URL.
     * @returns Mapa de parámetros.
     */
    private parseParams(values: string[]): Record<string, string|undefined> {
        const params: Record<string, string|undefined> = {};
        for (let i=0; i<this.paramsLength; i++) {
            params[this.params[i]] = values[i];
        }

        return params;
    }

    /**
     * Valida el idioma de la petición, normaliza los parámetros de URL y delega
     * la lógica de negocio en el `runner` proporcionado.
     * Si el runner lanza un error, lo registra con {@link error} y lo propaga.
     *
     * @param conexion - Conexión HTTP activa.
     * @param config   - Configuración de la aplicación.
     * @param runner   - Handler de negocio que recibe el contexto de petición.
     * @param opts     - Opciones: `checkLang` y `params` (posicionales o mapa).
     * @returns El valor devuelto por el runner.
     */
    public async run<C extends Configuracion, P>(conexion: Conexion, config: C, runner: TRouteRunner<C, P>, {checkLang=true, params: rawParams}: IRouteOptions={}): Promise<P> {
        if (checkLang && !this.checkLang(conexion.idioma)) {
            throw new Error("Not found");
        }

        const params: Record<string, string|undefined> = (rawParams && Array.isArray(rawParams))
            ? this.parseParams(rawParams)
            : rawParams ?? {};

        try {
            return await runner(config, {
                lang: conexion.idioma,
                dominio: conexion.getPeticion().headers.host ?? "",
                url: conexion.get,
                device: conexion.device,
                section: this,
                headers: conexion.getHeaders(),
                params,
            });
        } catch (err) {
            error(err);
            return Promise.reject(err);
        }
    }

    /**
     * Override point para redireccionamientos.
     * Las subclases deben sobreescribir este método para implementar la lógica de redirección.
     *
     * @param _conexion - Conexión HTTP activa (no usado en la implementación base).
     * @returns URL de destino del redireccionamiento.
     * @throws `Error("Handler not defined")` si no se sobreescribe.
     */
    public async redir(_conexion: Conexion): Promise<string> {
        throw new Error("Handler not defined");
    }
}
