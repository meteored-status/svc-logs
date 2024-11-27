import geoip from "geoip-lite";

import type {ICoordenadas} from "services-comun/modules/utiles/geopoint";

export interface IRegistroLocalizacion {
    pais: string;
    region: string;
    ciudad: string;
    coordenadas: ICoordenadas;
    precision: number;
    timezone: string;
    eu: boolean;
}

export class RegistroLocalizacion implements IRegistroLocalizacion{
    /* STATIC */
    public static build(ip?: string): RegistroLocalizacion {
        if (ip==undefined || ip.length==0) {
            throw new Error("No se ha proporcionado una IP");
        }

        const data = geoip.lookup(ip);
        if (data==null) {
            throw new Error("No se ha podido obtener la geolocalización");
        }

        return new this({
            pais: data.country,
            region: data.region,
            ciudad: data.city,
            coordenadas: {
                lat: data.ll[0],
                lon: data.ll[1],
            },
            precision: data.area,
            timezone: data.timezone,
            eu: data.eu != "0",
        });
    }

    /* INSTANCE */
    public get pais(): string { return this.data.pais; }
    public get region(): string { return this.data.region; }
    public get ciudad(): string { return this.data.ciudad; }
    public get coordenadas(): ICoordenadas { return this.data.coordenadas; }
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
