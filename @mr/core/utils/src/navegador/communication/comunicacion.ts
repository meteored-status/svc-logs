/**
 * Editor: miguel
 * Fecha: Fri, 13 Nov 2026 07:54:06 GMT
 * Hash: 5ac07e835e7c329934121a07bd28e28c
 * Versión: 2026.11.13+1-miguel
 * Anterior: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import {claveEmision, type IMessage, type TWhen} from "./eventos";
import {emitirInterfazPublica, type InterfazPublica} from "./utils/interfaz-publica";

/**
 * Lo que envía un componente: el origen lo pone `Comunicacion`.
 */
export type TMensaje = Omit<IMessage, "origin">;

/**
 * Una estrategia de comunicación del proyecto (`EstrategiaNavegador`, y mañana otras). Cada una tiene sus propios eventos (`TEventos`): qué método
 * emite y cuáles lo escuchan. Así una estrategia puede conectarse a un método de un componente y otra a otro.
 *
 * @property emisiones - Claves (`claveEmision`) de los eventos que emite la estrategia. Se calculan una vez, al crearla.
 * @property oyentes - Componentes que escuchan algún evento de la estrategia. Se calculan una vez, al crearla.
 * @property emit - Si la estrategia tiene un evento cuyo emisor es ese `metodo` del componente con ese `when`, lo envía.
 * @property escuchas - Los eventos en los que el componente es listener: por cada uno, el `metodo` (o atributo) que lo recibe y `escuchar`, que conecta un `callback` al evento.
 */
export interface IEstrategia {
    readonly emisiones: Iterable<string>;
    readonly oyentes: Iterable<string>;
    emit(componente: string, metodo: string, when: TWhen, message: IMessage): void;
    escuchas(componente: string): IEscucha[];
}

/**
 * Un evento que escucha un componente: el `metodo` (o atributo) del componente que lo recibe y `escuchar`, que conecta lo que hace al recibirlo. Solo llegan los
 * mensajes de otros componentes: cada estrategia descarta los del propio componente (el `origin`), para evitar bucles.
 */
export interface IEscucha {
    metodo: string;
    escuchar(callback: (value: unknown) => void, signal?: AbortSignal): void;
}

/**
 * Lo que hace un componente al recibir un evento: recibe el `value` del mensaje. Lo escribe el componente (suele ser una flecha sobre sus miembros), así que
 * `Comunicacion` no necesita su instancia.
 */
export type TReceptor = (value: unknown) => void;

/**
 * Clase global que globlas las diferentes estrategias de envio/escucha de eventos.
 *
 * Guarda en objetos, que obtiene de cada estrategia, sobre los objetos de eventos de cada estrategia.
 * Y hace de filtro, para iniciar el proceso de cada estrategia.
 */
export class Comunicacion {
    /* INSTANCE */
    private readonly emisiones: Map<string, IEstrategia[]>;
    private readonly oyentes: Map<string, IEstrategia[]>;

    public constructor(...estrategias: IEstrategia[]) {
        this.emisiones = new Map();
        this.oyentes = new Map();
        for (const estrategia of estrategias) {
            for (const clave of estrategia.emisiones) {
                this.emisiones.set(clave, [...this.emisiones.get(clave) ?? [], estrategia]);
            }
            for (const componente of estrategia.oyentes) {
                this.oyentes.set(componente, [...this.oyentes.get(componente) ?? [], estrategia]);
            }
        }
    }

    /**
     * Inicia el proceso de emisión para todas las estrategias si se da la condición.
     */
    public emit(componente: string, metodo: string, when: TWhen, message: TMensaje): void {
        for (const estrategia of this.emisiones.get(claveEmision(`${componente}:${metodo}`, when)) ?? []) {
            estrategia.emit(componente, metodo, when, {origin: componente, ...message});
        }
    }

    /**
     * Registra un componente con su interfaz pública (`crearInterfazPublica`: lo que se puede llamar o asignar desde fuera). La envuelve para que cada llamada emita `before` y
     * `after` (`emitirInterfazPublica`), la conecta a los eventos que escucha, en todas las estrategias (al llegar uno, llama a la entrada que dice el evento con su `value`) y la
     * devuelve: el componente debe llamarse a sí mismo por ella para que emita. Falla si un evento apunta a algo que la interfaz no tiene. `Comunicacion` nunca conoce la instancia.
     */
    public add<T>(nombre: string, interfaz: InterfazPublica<T>, signal?: AbortSignal): InterfazPublica<T> {
        const envuelta = emitirInterfazPublica(interfaz, nombre, (componente, metodo, when, message) => { this.emit(componente, metodo, when, message); });
        const receptores = envuelta as Record<string, TReceptor | undefined>;
        for (const {metodo, escuchar} of this.escuchas(nombre)) {
            const receptor = receptores[metodo];
            if (typeof receptor !== "function") {
                throw new Error(`${nombre}: el evento apunta a "${metodo}", que no está en su interfaz`);
            }
            escuchar(receptor, signal);
        }

        return envuelta;
    }

    private escuchas(nombre: string): IEscucha[] {
        return [...this.oyentes.get(nombre) ?? []].flatMap((estrategia) => estrategia.escuchas(nombre));
    }
}
