/**
 * Editor: miguel
 * Fecha: Wed, 18 Nov 2026 11:11:39 GMT
 * Hash: ce3be91d4c0e3b4fc40be01d06b937ad
 * Versión: 2026.11.18+1-miguel
 * Anterior: 2026.11.13+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import {claveEmision, esPeticion, type IMessage, type TWhen} from "./eventos";
import {interceptarMiembros} from "../objects/interceptar";

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
 * mensajes de otros componentes: cada estrategia descarta los del propio componente (el `origin`), para evitar bucles. Si el evento es una petición (`esPeticion`), la estrategia llama al `callback` sin argumentos: el receptor responde con su getter y
 * la estrategia devuelve lo que responde a quien pidió.
 *
 * @property respuesta - Es la escucha de quien pidió: `metodo` es su petición (`get_x`) y el `callback` recibe lo que responden, que es lo que devuelve esa llamada.
 */
export interface IEscucha {
    metodo: string;
    respuesta?: boolean;
    escuchar(callback: (...args: unknown[]) => unknown, signal?: AbortSignal): void;
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
    private readonly estrategias: IEstrategia[];
    private readonly respuestas: Map<string, unknown>;
    private readonly conectados: WeakSet<object>;

    public constructor(...estrategias: IEstrategia[]) {
        this.estrategias = estrategias;
        this.emisiones = new Map();
        this.oyentes = new Map();
        this.respuestas = new Map();
        this.conectados = new WeakSet();
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
     * Una `Comunicacion` nueva con las estrategias de esta más `estrategias`. Los componentes registrados en una no lo están en la otra.
     */
    public extender(...estrategias: IEstrategia[]): Comunicacion {
        return new Comunicacion(...this.estrategias, ...estrategias);
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
     * Hace una petición de lectura (`get_x`, ver `esPeticion`) en nombre de `componente` y devuelve lo que responden, o `undefined` si nadie lo hace. Con el transporte `app`
     * (síncrono) la respuesta llega antes de que vuelva la llamada; con uno asíncrono no llega a tiempo y da `undefined`.
     */
    public pedir(componente: string, metodo: string): unknown {
        const clave = `${componente}:${metodo}`;
        this.respuestas.delete(clave);
        this.emit(componente, metodo, "after", {value: undefined});
        const respuesta = this.respuestas.get(clave);
        this.respuestas.delete(clave);

        return respuesta;
    }

    /**
     * Conecta un objeto ya construido directamente: sus métodos y setters pasan a emitir `before` y `after` (`interceptarMiembros`) y cada evento que escucha
     * llama a su miembro del mismo nombre: un método se ejecuta, un accesor o un atributo se lee (sin argumentos) o se asigna (con uno). Solo los métodos y setters emiten; escribir
     * un atributo normal desde dentro no. Las peticiones de lectura (`get_x`) no emiten por su cuenta: las hace el objeto con `pedir`. Falla si un evento apunta a un miembro que no existe.
     */
    public conectar(nombre: string, instancia: object, signal?: AbortSignal): void {
        if (this.conectados.has(instancia)) {
            return;
        }
        this.conectados.add(instancia);
        interceptarMiembros(instancia, {
            antes: (miembro, args) => { this.emit(nombre, miembro, "before", {value: args}); },
            despues: (miembro, valor) => { this.emit(nombre, miembro, "after", {value: valor}); },
            omitir: (miembro) => esPeticion(`${nombre}:${miembro}`),
        });
        const objeto = instancia as Record<string, unknown>;
        for (const {metodo, respuesta, escuchar} of this.escuchas(nombre)) {
            if (respuesta) {
                escuchar((valor) => { this.respuestas.set(`${nombre}:${metodo}`, valor); }, signal);
                continue;
            }
            if (!(metodo in objeto)) {
                throw new Error(`${nombre}: el evento apunta a "${metodo}", que no está en el objeto`);
            }
            escuchar((...args) => {
                const miembro = objeto[metodo];
                if (typeof miembro === "function") {
                    return (miembro as (...a: unknown[]) => unknown).apply(instancia, args);
                }
                if (args.length > 0) {
                    objeto[metodo] = args[0];
                }

                return objeto[metodo];
            }, signal);
        }
    }

    private escuchas(nombre: string): IEscucha[] {
        return [...this.oyentes.get(nombre) ?? []].flatMap((estrategia) => estrategia.escuchas(nombre));
    }
}
