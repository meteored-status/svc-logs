/**
 * Editor: miguel
 * Fecha: Thu, 12 Nov 2026 11:34:11 GMT
 * Hash: 53f5a0d10831fe8c86ccf1b970d16559
 * Versión: 2026.11.12+1-miguel
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
