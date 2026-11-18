/**
 * Editor: miguel
 * Fecha: Wed, 18 Nov 2026 11:11:39 GMT
 * Hash: 086b86bd37b17ba91748d74732008454
 * Versión: 2026.11.18+1-miguel
 * Anterior: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

/**
 * Define los momentos en que puede emitirse un evento, antes o después de un método.
 */
export type TWhen = "before" | "after";

/**
 * El tipo del objeto que define los eventos en el proyecto
 */
export type TEventos<C extends string = string> = {
    [componente: string]: {
        [metodo: string]: {
            when?: TWhen;
            transporte?: C | C[];
            listeners?: {
                [componente: string]: string | string[];
            };
        };
    };
};

/**
 * El tipo decodificado del objeto eventos.
 */
export interface IEventoDecodificado<C extends string = string> {
    name: string;
    when: TWhen;
    transportes: C[];
    listeners: Record<string, string[]>;
}

/**
 * Pasa de un objeto de tipo TEventos a IEventoDecodificado.
 */
export function decodificacionEventos<C extends string>(eventos: TEventos<C>, defecto: NoInfer<C>): IEventoDecodificado<C>[] {
    return Object.entries(eventos).flatMap(([componente, metodos]) => Object.entries(metodos).map(([metodo, {when = "after", transporte = defecto, listeners = {}}]) => ({
        name: `${componente}:${metodo}`,
        when,
        transportes: [transporte].flat() as C[],
        listeners: Object.fromEntries(Object.entries(listeners).map(([listener, miembros]) => [listener, [miembros].flat()])),
    })));
}

/**
 * Las peticiones de lectura son eventos cuyo método empieza por `get_` (`buscador:get_last`), y solo se declaran en quien pide: quien lo escucha no recibe un valor, se le llama sin
 * argumentos (lee) y lo que devuelve vuelve a quien pidió, por el evento de respuesta (`nombreRespuesta`), y es lo que devuelve su llamada (`get_last()` da lo que respondan las cookies). La
 * respuesta no es una petición, y por eso no hay bucles.
 */
export const PREFIJO_PETICION = "get_";
const PREFIJO_RESPUESTA = "respuesta_";

/**
 * Si el evento `componente:metodo` es una petición de lectura.
 */
export function esPeticion(name: string): boolean {
    return name.slice(name.indexOf(":") + 1).startsWith(PREFIJO_PETICION);
}

/**
 * El evento por el que vuelve la respuesta a la petición `name`: `buscador:get_last` → `buscador:respuesta_last`.
 */
export function nombreRespuesta(name: string): string {
    return name.replace(`:${PREFIJO_PETICION}`, `:${PREFIJO_RESPUESTA}`);
}

/**
 * Un tipo base para emitir la clave del evento.
 */
export function claveEmision(name: string, when: TWhen): string {
    return `${name}:${when}`;
}

/**
 * La información del evento personalizado.
 */
export interface IMessage<T = unknown> {
    origin: string;
    value: T;
}
