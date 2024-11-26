import geoip from "geoip-lite";

import type {ICoordenadas} from "services-comun/modules/utiles/geopoint";

export interface IRegistroLocalizacion {
    ciudad: string;
    coordenadas: ICoordenadas;
    pais: string;
    region: string;
    timezone: string;
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
            ciudad: data.city,
            coordenadas: {
                lat: data.ll[0],
                lon: data.ll[1],
            },
            pais: data.country,
            region: data.region,
            timezone: data.timezone,
        });
    }

    /* INSTANCE */
    public get ciudad(): string { return this.data.ciudad; }
    public get coordenadas(): ICoordenadas { return this.data.coordenadas; }
    public get pais(): string { return this.data.pais; }
    public get region(): string { return this.data.region; }
    public get timezone(): string { return this.data.timezone; }

    protected constructor(private data: IRegistroLocalizacion) {
    }

    public toJSON(): IRegistroLocalizacion {
        return {
            ciudad: this.data.ciudad,
            coordenadas: this.data.coordenadas,
            pais: this.data.pais,
            region: this.data.region,
            timezone: this.data.timezone,
        };
    }
}
