/**
 * Editor: miguel
 * Fecha: Thu, 12 Nov 2026 11:34:11 GMT
 * Hash: 986e718a45f4c0618a43811414d2ac10
 * Versión: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import type {IEscucha, IEstrategia} from "../comunicacion";
import {claveEmision, decodificacionEventos, type IEventoDecodificado, type IMessage, type TEventos, type TWhen} from "../eventos";
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

        //Decodifica los eventos que recibe, para que sea más sencillo buscar información.
        for (const evento of decodificacionEventos(eventos, defecto)) {
            this.eventos.set(claveEmision(evento.name, evento.when), evento);
            for (const [componente, miembros] of Object.entries(evento.listeners)) {
                const nuevos = miembros.flatMap((metodo) => evento.transportes.map((transporte) => ({name: evento.name, transporte, metodo})));
                this.recibidos.set(componente, [...this.recibidos.get(componente) ?? [], ...nuevos]);
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
     * Los eventos que escucha el componente en el navegador: cada uno se conecta a su transporte.
     */
    public escuchas(componente: string): IEscucha[] {
        return (this.recibidos.get(componente) ?? []).map(({name, transporte, metodo}) => ({
            metodo,
            escuchar: (callback, signal) => {
                this.transportes[transporte].listen(name, ({origin, value}) => {
                    //Si el que lanza el evento es el mismo que escucha lo frena para evitar bucles.
                    if (origin !== componente) {
                        callback(value);
                    }
                }, signal);
            },
        }));
    }
}
