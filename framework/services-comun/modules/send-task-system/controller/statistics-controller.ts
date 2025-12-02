import {Configuracion} from "../utiles/config";
import {mkdir, readJSON, safeWrite} from "../../utiles/fs";
import {error, info} from "../../utiles/log";
import {IDAOFactory} from "../data/dao/d-a-o-factory";
import {SendEvent} from "../data/model/send-event";
import {Receiver} from "../data/model/receiver";
import {CalculatorBuilder} from "../statistics/calculator-builder";

interface StatisticsRecalculate {
    from: number;
}

export class StatisticsController {
    /* STATIC */

    /* INSTANCE */
    public constructor(
        private readonly config: Configuracion,
        private readonly factory: IDAOFactory) {
    }

    public async run(): Promise<void> {

        // Cargamos el fichero
        const recalculate: StatisticsRecalculate = await readJSON<StatisticsRecalculate>(this.config.statisticsControlFile).catch(async () => {
            const path = this.config.statisticsControlFile.split('/').slice(0, -1);

            await mkdir(path.join('/'), true).catch(e => {
                error(`Error al crear directorio: ${e}`);
            });
            return {
                from: 1
                /*
                  Se pone la fecha del inicio de los tiempos (o casi) para recalcular todas las estadísticas.
                 */
            }
        });

        info(`Recalculando estadísticas desde ${new Date(recalculate.from).toISOString()}...`);

        const scroll = await this.factory.event.createScroll();

        let events: SendEvent[] = [];

        let numEvents = 0;

        const from = new Date(recalculate.from);
        const to = new Date();

        let last = from;

        do {
            events = await this.factory.event.search({
                size: 1000,
                created: {
                    from,
                    to
                }
            }, scroll);

            if (events.length === 0) {
                break;
            }

            last = new Date(events[events.length - 1].created.getTime() + 1);

            numEvents += events.length;

            info(`Procesando ${events.length} eventos (${numEvents})...`);

            // Indexamos los eventos por sendId y receptor. La Key del mapa es <receiver>-<sendId>
            const eventsMap: Map<string, SendEvent[]> = new Map();

            events.forEach(event => {
                const key = `${event.receiver}-${event.sendId}`;
                let indexedEvents: SendEvent[];

                if (eventsMap.has(key)) {
                    indexedEvents = eventsMap.get(key)!;
                } else {
                    indexedEvents = [];
                    eventsMap.set(key, indexedEvents);
                }

                indexedEvents.push(event);
            });

            // Creamos un bulk de envíos
            const bulk = await this.factory.receiver.createBulk(
                {
                    chunk: 1000,
                    waitToSave: true
                }
            );

            // Creamos un scroll para recorrer los receptores
            const receiverScroll = await this.factory.receiver.createScroll();

            // Mapa de indexación de los receptores por SendID. La Key del mapa es <receiverId>-<sendId>
            const receiverMap: Map<string, Receiver> = new Map();

            // Recuperamos los receptores de los eventos
            let receivers: Receiver[] = [];
            let numReceivers = 0;

            do {
                receivers = await this.factory.receiver.getBySendIds(events.map(event => event.sendId || ''), receiverScroll);

                if (receivers.length === 0) {
                    break;
                }

                numReceivers += receivers.length;

                info(`Procesando ${receivers.length} receptores (${numReceivers})...`);

                receivers.forEach(receiver => {
                    const key = `${receiver.id}-${receiver.sendId}`;
                    let indexedReceiver;

                    if (receiverMap.has(key)) {
                        indexedReceiver = receiverMap.get(key)!;
                    } else {
                        indexedReceiver = receiver;
                        receiverMap.set(key, indexedReceiver);
                    }

                    this.calculateStatistics(indexedReceiver, eventsMap.get(key) || []);
                });

            } while (true);

            await receiverScroll.close();

            // Guardamos los receptores
            bulk.update(Array.from(receiverMap.values()));

            info(`Guardando ${receiverMap.size} receptores...`);
            await bulk.run();
            info(`Guardados ${receiverMap.size} receptores => OK`);

            // Actualizamos la marca de tiempo por la que nos hemos quedado comprobando
            recalculate.from = Math.max(from.getTime(), last.getTime());
            await safeWrite(this.config.statisticsControlFile, JSON.stringify(recalculate, null, 2), true);

        } while (true);

        await scroll.close();

    }

    protected calculateStatistics(receiver: Receiver, events: SendEvent[]): void {
        if (!receiver.statistics) {
            receiver.statistics = {
                times_opened: 0,
                times_clicked: 0,
                time_until_open: 0,
                updated: Date.now(),
                bounce: false,
                spam: false,
                unsubscribe: false,
                received: false,
                first_open_count: 0,
                bounce_count: 0,
                unsubscribe_count: 0,
                spam_count: 0
            };
        }

        events.forEach(event => {
            const calculator = CalculatorBuilder.getInstance().build(event);
            calculator.calculate(receiver);
        });
    }
}
