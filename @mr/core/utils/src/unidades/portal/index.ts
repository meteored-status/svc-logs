/**
 * Editor: miguel
 * Fecha: Tue, 03 Nov 2026 07:22:11 GMT
 * Hash: 2adf8dbfaa0a9c7701648eb3a0921568
 * Versión: 2026.11.3+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import {TDistancia} from "../magnitudes/distancia";
import {TNieve} from "../magnitudes/nieve";
import {TPrecipitacion} from "../magnitudes/precipitacion";
import {TPresion} from "../magnitudes/presion";
import {TRayos} from "../magnitudes/rayos";
import {TTemperatura} from "../magnitudes/temperatura";
import {TVelocidad} from "../magnitudes/velocidad";

export interface IUnidadesPortal {
    altitud: TDistancia;
    distancia: TDistancia;
    lluvia: TPrecipitacion;
    nieve: TNieve;
    presion: TPresion;
    rayos: TRayos;
    temperatura: TTemperatura;
    viento: TVelocidad;
}

/**
 * Unidades de medida por defecto de todos los portales. Cada portal hereda de aquí y solo indica lo que cambia.
 */
export const unidadesDefecto: IUnidadesPortal = {
    altitud: TDistancia.METROS,
    distancia: TDistancia.KM,
    lluvia: TPrecipitacion.mm,
    nieve: TNieve.cm,
    presion: TPresion.hpa,
    rayos: TRayos.km2,
    temperatura: TTemperatura.CENTIGRADOS,
    viento: TVelocidad.KMH,
};

/**
 * Unidades de medida por defecto de un portal, fusionando lo que cambia con {@link unidadesDefecto}. Los portales
 * sin cambios usan `new UnidadesPortal({id})`.
 *
 * @template TId - Tipo del identificador del portal.
 */
export class UnidadesPortal<TId extends string = string> implements IUnidadesPortal {
    /* INSTANCE */

    public readonly id: TId;
    public readonly altitud: TDistancia;
    public readonly distancia: TDistancia;
    public readonly lluvia: TPrecipitacion;
    public readonly nieve: TNieve;
    public readonly presion: TPresion;
    public readonly rayos: TRayos;
    public readonly temperatura: TTemperatura;
    public readonly viento: TVelocidad;

    public constructor({id, ...cambios}: Partial<IUnidadesPortal> & {id: TId}) {
        const unidades: IUnidadesPortal = {...unidadesDefecto, ...cambios};

        this.id = id;
        this.altitud = unidades.altitud;
        this.distancia = unidades.distancia;
        this.lluvia = unidades.lluvia;
        this.nieve = unidades.nieve;
        this.presion = unidades.presion;
        this.rayos = unidades.rayos;
        this.temperatura = unidades.temperatura;
        this.viento = unidades.viento;
    }
}
