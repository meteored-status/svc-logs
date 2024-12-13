export interface ILogErrorCTX {
    linea: number;
    codigo: string;
}

export interface ILogError {
    timestamp: Date;
    checked: boolean;
    proyecto: string;
    servicio: string;
    url: string;
    mensaje: string;
    archivo: string;
    linea: string;
    traza: string[];
    ctx: ILogErrorCTX[];
}

export interface ILogErrorES {
    "@timestamp": string;
    checked: boolean;
    proyecto: string;
    servicio: string;
    url: string;
    mensaje: string;
    archivo: string;
    linea: string;
    traza?: string|string[];
    ctx?: ILogErrorCTX|ILogErrorCTX[];
}

export abstract class LogError implements ILogError {
    /* STATIC */
    private static INDEX = "mr-log-errores";
    protected static getIndex(proyecto: string): string {
        return `${this.INDEX}-${proyecto.toLowerCase()}`;
    }

    protected static getAlias(): string {
        return this.INDEX;
    }

    /* INSTANCE */
    public get timestamp(): Date { return this.data.timestamp; }
    public get checked(): boolean { return this.data.checked; }
    public get proyecto(): string { return this.data.proyecto; }
    public get servicio(): string { return this.data.servicio; }
    public get url(): string { return this.data.url; }
    public get mensaje(): string { return this.data.mensaje; }
    public get archivo(): string { return this.data.archivo; }
    public get linea(): string { return this.data.linea; }
    public get traza(): string[] { return this.data.traza; }
    public get ctx(): ILogErrorCTX[] { return this.data.ctx; }

    protected constructor(private data: ILogError) {
    }

    public toJSON(): ILogErrorES {
        return {
            "@timestamp": this.data.timestamp.toISOString(),
            checked: this.data.checked,
            proyecto: this.data.proyecto,
            servicio: this.data.servicio,
            url: this.data.url,
            mensaje: this.data.mensaje,
            archivo: this.data.archivo,
            linea: this.data.linea,
            traza: this.data.traza.length>0?
                this.data.traza : undefined,
            ctx: this.data.ctx.length>0?
                this.data.ctx : undefined,
        };
    }
}
