import {IPodInfo} from "services-comun/modules/utiles/config";
import elastic from "services-comun/modules/utiles/elastic";
import {error} from "services-comun/modules/utiles/log";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";

import type {Cliente} from "./cliente";

interface ITelemetry {
    proyecto: string;
    subproyecto?: string;
    servicio: string;
    version: string;
    source: string;
    ingestTime: number;
    start: Date;
    end: Date;
    records?: number;
    saltados?: number;
}

interface ITelemetryES {
    "@timestamp": string;
    proyecto: string;
    subproyecto?: string;
    servicio: string;
    version: string;
    source: string;
    ingestTime: number;
    start: string;
    end: string;
    records: number;
    saltados: number;
    rps?: number;
}

export class Telemetry implements ITelemetry {
    /* STATIC */
    private static INDEX = `mr-telemetry-accesos`;

    public static build(cliente: Cliente, pod: IPodInfo, source: string): Telemetry {
        const [start, end] = source.split("/")
            .at(-1)!
            .split("_")
            .slice(0, 2)
            .map((data) => new Date(data.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z")));
        return new this(cliente, {
            proyecto: cliente.id,
            subproyecto: cliente.grupo,
            servicio: pod.servicio,
            version: pod.version,
            source,
            ingestTime: new Date().getTime(),
            start,
            end,
        });
    }

    /* INSTANCE */
    public readonly timestamp: Date;
    public get proyecto(): string { return this.data.proyecto; }
    public get subproyecto(): string|undefined { return this.data.subproyecto; }
    public get servicio(): string { return this.data.servicio; }
    public get version(): string { return this.data.version; }
    public get source(): string { return this.data.source; }
    public get ingestTime(): number { return this.data.ingestTime; }
    public get start(): Date { return this.data.start; }
    public get end(): Date { return this.data.end; }
    public records: number;
    public saltados: number;

    public get idx(): number {
        return this.records++;
    }

    private time: number;

    public constructor(public readonly cliente: Cliente, private readonly data: ITelemetry) {
        this.timestamp = new Date();
        this.records = data.records??0;
        this.saltados = data.saltados??0;
        this.time = this.timestamp.getTime();
    }

    public initTimer(): void {
        this.time = Date.now();
    }

    public endTimer(): void {
        this.data.ingestTime = Date.now() - this.time;
    }

    public saltar(): void {
        this.saltados++;
        this.records++;
    }

    public toJSON(): ITelemetryES {
        return {
            "@timestamp": this.timestamp.toISOString(),
            proyecto: this.data.proyecto,
            subproyecto: this.data.subproyecto,
            servicio: this.data.servicio,
            version: this.data.version,
            source: this.data.source,
            ingestTime: this.data.ingestTime,
            start: this.data.start.toISOString(),
            end: this.data.end.toISOString(),
            records: this.records,
            saltados: this.saltados,
            rps: this.data.ingestTime>0 ? Math.round((this.records / this.data.ingestTime) * 1000) : undefined,
        };
    }

    public async toElastic(): Promise<void> {
        await elastic.index({
            index: Telemetry.INDEX,
            document: this.toJSON(),
        })
            .catch(async (err) => {
                if (err instanceof Error) {
                    if (err.name == "TimeoutError") {
                        await PromiseDelayed(Math.floor(Math.random() * 1000) + 1000);
                        return this.toElastic();
                    }
                    error("Error guardando telemetría", err.name, err.message, JSON.stringify(this.toJSON()));
                }
                return Promise.reject(err);
            });
    }
}
