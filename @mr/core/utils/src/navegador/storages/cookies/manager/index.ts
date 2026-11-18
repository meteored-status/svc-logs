/**
 * Editor: miguel
 * Fecha: Mon, 16 Nov 2026 15:13:05 GMT
 * Hash: c6d9441d5871e35e027b7df647328b46
 * Versión: 2026.11.16+1-miguel
 * Anterior: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/meteored-web-www.git
 */

import type {IServiceCookie} from "../services/base";
import type {TTiempo} from "./expiraciones";
import {deserializarLista, type IConversion, type ISerializador, Serializadores, serializarLista, type TNombreTipo, type TTipoBase, type TTipoBasico, type TValor} from "./tipos";

export type {TNombreTipo, TValor} from "./tipos";

/**
 * Definición de una cookie del esquema.
 *
 * @property nombre - Nombre real de la cookie en el navegador.
 * @property tipo - Tipo de dato de la cookie (ver {@link TNombreTipo}): con él se serializa al escribir y se deserializa al leer.
 * @property expira - Duración antes de expirar (ver {@link TTiempo}).
 * @property defecto - Valor cuando la cookie no existe o su contenido no es válido para el tipo; también el
 *   valor al que, si se vuelve a fijar, la cookie se elimina en vez de guardarse.
 * @property origen - Si no hay `defecto`, propiedad de `defectos` ({@link IManagerConfig}) de la que sale el valor
 *   por defecto.
 * @property lazy - Si `true`, la cookie no se lee del navegador hasta el primer `get` o `set`.
 *   Por defecto `false`: se lee al crear el manager.
 */
export interface ICookieConfig<K extends TNombreTipo = TNombreTipo> {
    nombre: string;
    tipo: K;
    expira: TTiempo;
    defecto?: TValor<K>;
    origen?: string;
    lazy?: boolean;
}

/**
 * Opciones de {@link CookieManager}.
 *
 * @property dominio - Dominio con el que se escriben y borran las cookies. Por defecto el del documento.
 * @property defectos - Objeto del que toman su valor por defecto las cookies con `origen` (p. ej. las unidades de un portal).
 */
export interface IManagerConfig {
    dominio?: string;
    defectos?: object;
}

/**
 * Esquema completo de un conjunto de cookies: todo lo que necesita un {@link CookieManager}.
 *
 * @property servicio - Servicio que lee, escribe y borra las cookies.
 * @property cookies - Una definición por clave.
 */
export interface IEsquemaCookies<E extends Record<PropertyKey, ICookieConfig> = Record<PropertyKey, ICookieConfig>> extends IManagerConfig {
    servicio: IServiceCookie;
    cookies: E;
}

/**
 * Gestión de un conjunto de cookies definido por un esquema ({@link IEsquemaCookies}). No sabe cómo se escribe
 * una cookie: eso lo hace el servicio del esquema ({@link IServiceCookie}), así que se puede cambiar sin tocar
 * las definiciones. `get` y `set` van tipados con el `tipo` de cada cookie.
 *
 * @typeParam E - Definiciones: una {@link ICookieConfig} por clave (típicamente las de un enum del proyecto).
 */
export class CookieManager<E extends Record<PropertyKey, ICookieConfig>> {
    /* INSTANCE */

    // El servicio de lectura para leer las cookies directamente del navegador.
    private readonly servicio: IServiceCookie;
    private readonly cookies: E;
    private readonly valores: Record<string, string | undefined>;
    private readonly dominio: string | undefined;
    private readonly defectos: object;

    /**
     * @param esquema - Servicio, definiciones y opciones (ver {@link IEsquemaCookies}).
     */
    public constructor({servicio, cookies, dominio, defectos = {}}: IEsquemaCookies<E>) {
        this.servicio = servicio;
        this.cookies = cookies;
        this.dominio = dominio;
        this.defectos = defectos;
        this.valores = {};
        for (const clave of Object.keys(cookies)) {
            if (!this.config(clave).lazy) {
                this.valores[clave] = this.leer(clave);
            }
        }
    }

    /**
     * Valor de `clave`, del tipo de su definición. El valor por defecto si la cookie no existe o su
     * contenido no es válido para el tipo.
     */
    public get<K extends keyof E>(clave: K): TValor<E[K]["tipo"]> {
        const id = String(clave);
        if (!(id in this.valores)) {
            this.valores[id] = this.leer(id);
        }
        const raw = this.valores[id];
        const valor = raw === undefined ? null : this.serializador(this.config(id).tipo).deserialize(raw);
        return (valor ?? this.defecto(id)) as TValor<E[K]["tipo"]>;
    }

    /**
     * Fija el valor de `clave`. Si es el valor por defecto la cookie se elimina en vez de guardarse.
     *
     * Un fallo al leer o escribir (cookies bloqueadas, cuota excedida, etc.) se silencia a propósito:
     * un problema de cookies no debe romper el resto de la página.
     */
    public set<K extends keyof E>(clave: K, valor: TValor<E[K]["tipo"]>): void {
        const id = String(clave);
        const {nombre, tipo, expira} = this.config(id);
        const serializador = this.serializador(tipo);
        const raw = serializador.serialize(valor);
        try {
            if (raw !== serializador.serialize(this.defecto(id))) {
                this.servicio.set(nombre, raw, new Date(Date.now() + expira), this.dominio);
            } else {
                this.servicio.remove(nombre, this.dominio);
            }
            this.valores[id] = raw;
        } catch {
            // Ver JSDoc de este método.
        }
    }

    /**
     * Elimina la cookie de `clave`, sea cual sea su valor: no depende de que coincida con el valor por defecto. Después, `get`
     * devuelve el valor por defecto.
     *
     * Un fallo al borrar se silencia a propósito, como en {@link set}.
     */
    public remove<K extends keyof E>(clave: K): void {
        const id = String(clave);
        try {
            this.servicio.remove(this.config(id).nombre, this.dominio);
            this.valores[id] = undefined;
        } catch {
            // Ver JSDoc de este método.
        }
    }

    private config(id: string): ICookieConfig {
        return this.cookies[id];
    }

    private defecto(id: string): unknown {
        const {nombre, defecto, origen} = this.config(id);
        const valor = defecto ?? (origen === undefined ? undefined : (this.defectos as Record<string, unknown>)[origen]);
        if (valor === undefined) {
            throw new Error(`La cookie ${nombre} no tiene valor por defecto`);
        }
        return valor;
    }

    private serializador(tipo: TNombreTipo): IConversion {
        if (tipo.endsWith("[]")) {
            const base = Serializadores[tipo.slice(0, -2) as TTipoBase] as unknown as ISerializador<TTipoBasico>;
            return {
                serialize: (valor) => serializarLista((valor as TTipoBasico[]).map((item) => base.serialize(item))),
                deserialize: (raw) => {
                    const items = deserializarLista(raw, (item) => base.deserialize(item));
                    return items.includes(null) ? null : items;
                },
            };
        }
        return Serializadores[tipo as TTipoBase] as unknown as IConversion;
    }

    private leer(id: string): string | undefined {
        try {
            return this.servicio.get(this.config(id).nombre);
        } catch {
            // decodeURIComponent puede lanzar con cookies mal formadas
            return undefined;
        }
    }
}
