import {BulkAuto} from "services-comun/modules/elasticsearch/bulk/auto";
import elastic from "services-comun/modules/utiles/elastic";

interface ILogServicio {
    timestamp: Date;
    proyecto: string;
    servicio: string;
    tipo: string;
    severidad: string;
    mensaje: string;
    extra: string[];
}

export interface ILogServicioES {
    "@timestamp": string;
    proyecto: string;
    servicio: string;
    tipo: string;
    severidad: string;
    mensaje: string;
    extra?: string|string[];
}

export class Log {
    /* STATIC */
    private static INDEX = "mr-log-servicios";
    public static getIndex(proyecto: string): string {
        return `${this.INDEX}-${proyecto.toLowerCase()}`;
    }
    public static getAlias(): string {
        return this.INDEX;
    }

    public static BULK = new BulkAuto(elastic);
    static {
        this.BULK.start();
    }

    /* INSTANCE */
    public get timestamp(): Date { return this.data.timestamp; }
    public get proyecto(): string { return this.data.proyecto; }
    public get servicio(): string { return this.data.servicio; }
    public get tipo(): string { return this.data.tipo; }
    public get severidad(): string { return this.data.severidad; }
    public get mensaje(): string { return this.data.mensaje; }
    public get extra(): string[] { return this.data.extra; }

    public constructor(private data: ILogServicio) {
    }

    public toJSON(): ILogServicioES {
        return {
            "@timestamp": this.data.timestamp.toISOString(),
            proyecto: this.data.proyecto,
            servicio: this.data.servicio,
            tipo: this.data.tipo,
            severidad: this.data.severidad,
            mensaje: this.data.mensaje,
            extra: this.data.extra.length>0 ?
                this.data.extra : undefined,
        };
    }
}
