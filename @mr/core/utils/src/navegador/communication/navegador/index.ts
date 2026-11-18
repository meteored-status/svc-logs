/**
 * Editor: miguel
 * Fecha: Wed, 18 Nov 2026 11:11:39 GMT
 * Hash: 6bb9ec3b3f214241de877e19a290c5b9
 * Versión: 2026.11.18+1-miguel
 * Anterior: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import type {IEscucha, IEstrategia} from "../comunicacion";
import {claveEmision, decodificacionEventos, esPeticion, type IEventoDecodificado, type IMessage, nombreRespuesta, type TEventos, type TWhen} from "../eventos";
import type {ITransporte} from "./transporte";
import {TransporteBroadcastChannel} from "./transportes/broadcast-channel";
import {TransporteEventoDom} from "./transportes/evento-dom";

/**
 * Tipos de transporte que se pueden usar.
 */
export type TTransporteNavegador = "app" | "window" | "document" | "broadcastChannel";

/**
 * Los eventos de la estrategia del navegador: cada uno puede elegir su `transporte` (o varios).
 */
export type TEventosNavegador = TEventos<TTransporteNavegador>;

/**
 * @property eventos - Los eventos de la estrategia, por emisor: qué método emite y quién lo escucha.
 * @property defecto - Transporte de los eventos que no digan `transporte`. Por defecto `app`.
 * @property app - El `EventTarget` del transporte `app`. Por defecto, uno propio de cada estrategia; si dos `EstrategiaNavegador` reciben el mismo, comparten el bus.
 */
export interface IConfigNavegador {
    eventos: TEventosNavegador;
    defecto?: TTransporteNavegador;
    app?: EventTarget;
}

/**
 * Un evento que escucha un componente: su nombre, el transporte por el que va y el método (o atributo) que lo recibe.
 */
interface IRecibido {
    name: string;
    transporte: TTransporteNavegador;
    metodo: string;
    respuesta: boolean;
}

/**
 * Clase para el envío de eventos en el cliente.
 */
export class EstrategiaNavegador implements IEstrategia {
    /* INSTANCE */
    private readonly eventos: Map<string, IEventoDecodificado<TTransporteNavegador>>;
    private readonly transportes: Record<TTransporteNavegador, ITransporte>;
    private readonly recibidos: Map<string, IRecibido[]>;

    public get emisiones(): Iterable<string> { return this.eventos.keys(); }
    public get oyentes(): Iterable<string> { return this.recibidos.keys(); }

    public constructor({eventos, defecto = "app", app = new EventTarget()}: IConfigNavegador) {
        this.transportes = {
            app: new TransporteEventoDom(app),
            window: new TransporteEventoDom(window),
            document: new TransporteEventoDom(document),
            broadcastChannel: new TransporteBroadcastChannel()
        };
        this.recibidos = new Map();
        this.eventos = new Map();

        // Decodifica los eventos, para que sea más sencillo buscar información.
        for (const evento of decodificacionEventos(eventos, defecto)) {
            const {name, transportes} = evento;
            this.eventos.set(claveEmision(name, evento.when), evento);
            for (const [componente, miembros] of Object.entries(evento.listeners)) {
                this.recibir(componente, name, transportes, miembros, false);
            }
            // Quien pide una lectura escucha la respuesta: es lo que devuelve su llamada.
            if (esPeticion(name)) {
                this.recibir(name.slice(0, name.indexOf(":")), nombreRespuesta(name), transportes, [name.slice(name.indexOf(":") + 1)], true);
            }
        }
    }

    /**
     * Emite el evento en el navegador.
     */
    public emit(componente: string, metodo: string, when: TWhen, message: IMessage): void {
        const evento = this.eventos.get(claveEmision(`${componente}:${metodo}`, when));
        if (evento) {
            for (const transporte of evento.transportes) {
                this.transportes[transporte].emit(evento.name, message);
            }
        }
    }

    /**
     * Los eventos que escucha el componente en el navegador: cada uno se conecta a su transporte. Una petición de lectura (`esPeticion`) no lleva valor: se llama al receptor
     * sin argumentos y lo que devuelve vuelve a quien pidió (`responder`).
     */
    public escuchas(componente: string): IEscucha[] {
        return (this.recibidos.get(componente) ?? []).map(({name, transporte, metodo, respuesta}) => ({
            metodo,
            respuesta,
            escuchar: (callback, signal) => {
                this.transportes[transporte].listen(name, ({origin, value}) => {
                    // Si el que lanza el evento es el mismo que escucha, se frena para evitar bucles.
                    if (origin === componente) {
                        return;
                    }
                    if (esPeticion(name)) {
                        this.responder(transporte, name, componente, callback());
                    } else {
                        callback(value);
                    }
                }, signal);
            },
        }));
    }

    /**
     * Apunta que `componente` recibe el evento `name` en esos `miembros`, por cada uno de los `transportes`.
     */
    private recibir(componente: string, name: string, transportes: TTransporteNavegador[], miembros: string[], respuesta: boolean): void {
        const nuevos = miembros.flatMap((metodo) => transportes.map((transporte) => ({name, transporte, metodo, respuesta})));
        this.recibidos.set(componente, [...this.recibidos.get(componente) ?? [], ...nuevos]);
    }

    /**
     * Envía la respuesta a la petición `name` (si es una promesa, cuando se resuelva), por el mismo transporte y con el componente que la atiende como origen.
     */
    private responder(transporte: TTransporteNavegador, name: string, componente: string, respuesta: unknown): void {
        const emitir = (value: unknown): void => { this.transportes[transporte].emit(nombreRespuesta(name), {origin: componente, value}); };
        if (respuesta instanceof Promise) {
            void respuesta.then(emitir);
        } else {
            emitir(respuesta);
        }
    }
}
