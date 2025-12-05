import geoip from "geoip-lite";

export interface IRegistroLocalizacion {
    pais: string;
    region: string;
    ciudad: string;
    coordenadas: string;
    precision: number;
    timezone: string;
    eu: boolean;
}

export class RegistroLocalizacion implements IRegistroLocalizacion {
    /* STATIC */
    public static build(ip?: string): RegistroLocalizacion|undefined {
        if (!ip || ip.length===0) {
            return;
        }

        const data = geoip.lookup(ip);
        if (data==null) {
            return;
        }

        if (typeof data.ll[0] !== 'number' || typeof data.ll[1] !== 'number') {
            return;
        }

        return new this({
            pais: data.country,
            region: data.region,
            ciudad: data.city,
            coordenadas: `POINT(${data.ll[1]} ${data.ll[0]})`,
            precision: data.area,
            timezone: data.timezone,
            eu: data.eu !== "0",
        });
    }

    /* INSTANCE */
    public get pais(): string { return this.data.pais; }
    public get region(): string { return this.data.region; }
    public get ciudad(): string { return this.data.ciudad; }
    public get coordenadas(): string { return this.data.coordenadas; }
    public get precision(): number { return this.data.precision; }
    public get timezone(): string { return this.data.timezone; }
    public get eu(): boolean { return this.data.eu; }

    protected constructor(private data: IRegistroLocalizacion) {
    }

    public toJSON(): IRegistroLocalizacion {
        return {
            pais: this.data.pais,
            region: this.data.region,
            ciudad: this.data.ciudad,
            coordenadas: this.data.coordenadas,
            precision: this.data.precision,
            timezone: this.data.timezone,
            eu: this.data.eu,
        };
    }
}
