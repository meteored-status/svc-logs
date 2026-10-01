/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 29 Sep 2026 06:49:18 GMT
 * Hash: 31343ae98f8fc06dd89535f5d7007d0f
 * Versión: 2026.9.29+1-juancmartinez
 * Anterior: 2026.9.23+3-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-newsletter.git
 */

import {CronExpressionParser} from "cron-parser";

import {normalizarPatron} from "../../utiles/dia-semana";

export interface IPeriodicity {
    id?: number;
    pattern: string;
    timezone: string;
    send_task_id: number;
}

export class Periodicity {
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
     *
     * El patrón se lee normalizado con `normalizarPatron()` (`../../utiles/dia-semana`): `cron-parser`
     * rechaza un día de la semana repetido (`1,1`; y `0,7`, dos domingos, desde la 5.10.1) aunque el
     * patrón sea inequívoco.
     *
     * @param limitDate Fecha límite de inicio para la siguiente ejecución.
     * @throws {Error} Si `cron-parser` no sabe leer el patrón.
     */
    public nextExecutionDate(limitDate: Date = new Date()): Date {
        const interval = CronExpressionParser.parse(normalizarPatron(this.pattern), {
            tz: this.timezone
        });
        do {
            const nextDate = interval.next().toDate();
            if (nextDate > limitDate) {return nextDate;}
        } while (true);
    }
}
