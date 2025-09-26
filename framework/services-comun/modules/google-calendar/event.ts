import {Attendee, IAttendee} from "./attendee";

export interface IEvent {
    type: "VEVENT"|"VTIMEZONE";
    start: string;
    end: string;
    summary: string;
    rrule?: IRRule;
    attendee?: IAttendee[]|IAttendee;
    recurrences?: {
        [key: string]: IEvent;
    }
}

interface IRRule {
    origOptions: {
        until: string;
    }
}

export class Event {
    /* STATIC */
    public static build(data: IEvent): Event[] {
        const result: Event[] = [];

        const from: number = new Date(data.start).getTime();
        let until: number;
        if (data.rrule) {
            until = new Date(data.rrule.origOptions.until).getTime();
        } else {
            until = new Date(data.end).getTime();
        }
        let ts: number = from;
        let tsEnd: number = new Date(data.end).getTime();
        while (ts <= until) {
            const event: Event = new Event({
                ...data,
                start: new Date(ts).toISOString(),
                end: new Date(tsEnd).toISOString()
            });
            result.push(event);

            ts += 86400000;
            tsEnd += 86400000;
        }

        if (data.recurrences) {
            for (const key of Object.keys(data.recurrences)) {
                const recurrence: IEvent = data.recurrences[key];
                const events: Event[] = Event.build(recurrence);
                result.push(...events);
            }
        }

        return result;
    }

    /* INSTANCE */
    private readonly _attendees: Attendee[];
    private constructor(private readonly _data: IEvent) {
        const attendeesDatas: IAttendee[] = [];
        if (this._data.attendee) {
            if (Array.isArray(this._data.attendee)) {
                attendeesDatas.push(...this._data.attendee);
            } else {
                attendeesDatas.push(this._data.attendee);
            }
        }

        this._attendees = attendeesDatas.map(a => new Attendee(a))??[];
    }

    protected get data(): IEvent {
        return this._data;
    }

    public get start(): number {
        return new Date(this.data.start).getTime();
    }

    public get end(): number {
        return new Date(this.data.end).getTime();
    }

    public get summary(): string {
        return this.data.summary;
    }

    public mainName(): string|undefined {
        const match: RegExpMatchArray|null = this.summary.match(/^([.\w\sáéíóúÁÉÍÓÚ]+) - Guardia$/);
        if (match) return match[1].trim();
        return undefined;
    }

    public get attendees(): Attendee[] {
        return this._attendees;
    }
}
