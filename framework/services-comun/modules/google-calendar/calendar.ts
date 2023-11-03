import ical from "node-ical";
import {Event, IEvent} from "./event";
import {readJSON, safeWriteStream} from "../utiles/fs";

interface IConfigCalendar {
    ics: string;
}

export class Calendar {
    /* STATIC */
    public static async get (): Promise<Calendar> {
        const config: IConfigCalendar = await readJSON<IConfigCalendar>('files/credenciales/calendar.json');
        // Descargamos el calendario
        const resource = await fetch(config.ics);
        if (resource.body) {
            const file: string = 'files/tmp/calendar.ics';
            // @ts-ignore
            await safeWriteStream(resource.body, file, true);
            return new Calendar(file)
        }
        return Promise.reject('Calendar not found');
    }

    /* INSTANCE */
    private readonly eventIdx: NodeJS.Dict<NodeJS.Dict<NodeJS.Dict<Event[]>>>;

    private constructor(file: string) {
        const events = ical.sync.parseFile(file);

        this.eventIdx = {};

        for (const key of Object.keys(events)) {
            const data: IEvent = (events as any)[key];
            if (data.type === "VEVENT") {
                const events = Event.build(data);
                events.forEach(event => {
                    const start = new Date(event.start);
                    const yearIdx: NodeJS.Dict<NodeJS.Dict<Event[]>> = this.eventIdx[start.getUTCFullYear()] ??= {};
                    const monthIdx: NodeJS.Dict<Event[]> = yearIdx[start.getUTCMonth()] ??= {};
                    (monthIdx[start.getUTCDate()] ??= []).push(event);
                });
            }
        }
    }

    /**
     * Recupera los eventos con una fecha de inicio determinada.
     * @param start Fecha de inicio.
     */
    public findByStartDate(start: Date): Event[] {
        return this.eventIdx[start.getUTCFullYear()]?.[start.getUTCMonth()]?.[start.getUTCDate()]??[];
    }

    public today(): Event[] {
        return this.findByStartDate(new Date());
    }
}
