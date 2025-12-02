import {
    CronExpressionParser,
    CronExpression,
    CronHour,
    CronMinute,
    HourRange,
    SixtyRange,
    CronFieldCollection, CronSecond, CronDayOfMonth, CronMonth, CronDayOfWeek
} from "cron-parser";

export interface IPeriodicity {
    id?: number;
    pattern: string;
    timezone: string;
    send_task_id: number;
}

export class Periodicity {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly _data: IPeriodicity) {
    }

    private get data(): IPeriodicity {
        return this._data;
    }

    public get id(): number | undefined {
        return this.data.id;
    }

    public get pattern(): string {
        return this.data.pattern;
    }

    public get timezone(): string {
        return this.data.timezone;
    }

    public get sendTaskId(): number {
        return this.data.send_task_id;
    }

    /**
     * Devuelve la fecha de la siguiente ejecución de la tarea.
     * Lo hace a partir de una fecha límite.
     * @param limitDate Fecha límite de inicio para la siguiente ejecución.
     */
    public nextExecutionDate(limitDate: Date = new Date()): Date {
        const interval = CronExpressionParser.parse(this.pattern, {
            tz: this.timezone
        });
        do {
            const nextDate = interval.next().toDate();
            if (nextDate > limitDate) return nextDate;
        } while (true);
    }
}
