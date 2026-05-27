export enum TVelocidad {
    MPH = 1,
    KMH = 2,
    KNOTS = 3,
    MPS = 4,
    BEAUFORT = 5,
}

export const VelocidadUnidad: Record<TVelocidad, string> = {
    [TVelocidad.MPH]: "mph",
    [TVelocidad.KMH]: "Km/h",
    [TVelocidad.KNOTS]: "kt",
    [TVelocidad.MPS]: "m/s",
    [TVelocidad.BEAUFORT]: "beaufort",
};

const VELOCIDAD_MPH_KHM = 1.609346;
const VELOCIDAD_MPH_KNOTS = 0.868977;
const VELOCIDAD_KMH_KNOTS = 0.539957;
const VELOCIDAD_KMH_MPS = 0.277778;
const VELOCIDAD_KNOTS_MPS = 0.514444;
const VELOCIDAD_MPH_MPS = 0.44704;

export enum TPrecipitacion {
    mm  = 0,
    in  = 1,
    lm2 = 2
}

export const PrecipitacionUnidad: Record<TPrecipitacion, string> = {
    [TPrecipitacion.mm]: "mm",
    [TPrecipitacion.in]: "in",
    [TPrecipitacion.lm2]: "l/m²",
};

export function convertirPrecipitacion(value: number, from: TPrecipitacion, to: TPrecipitacion): number {
    switch (from) {
        case TPrecipitacion.mm:
            switch (to) {
                case TPrecipitacion.in:
                    return value / 25.4;
                case TPrecipitacion.lm2:
                    return value;
            }
            break;
        case TPrecipitacion.in:
            switch (to) {
                case TPrecipitacion.mm:
                    return value * 25.4;
                case TPrecipitacion.lm2:
                    return value * 25.4;
            }
            break;
        default:
            switch (to) {
                case TPrecipitacion.mm:
                    return value;
                case TPrecipitacion.in:
                    return value / 25.4;
            }
            break;
    }
    return value;
}

export function redondearPrecipitacion(value: number, unidad: TPrecipitacion): number {
    switch (unidad) {
        case TPrecipitacion.in:
            if (value<1) {
                return Math.round(value*1000)/1000;
            }
            if (value<10) {
                return Math.round(value*100)/100;
            }
            if (value<1) {
                return Math.round(value*10)/10;
            }
            return Math.round(value);
        case TPrecipitacion.lm2:
        default:
            if (value<10) {
                return Math.round(value*10)/10;
            }
            return Math.round(value);
    }
}

export enum TNieve {
    cm  = 0,
    in  = 1,
}

export const NieveUnidad = (valor: number, unidad: TNieve)=> {
    switch(unidad) {
        case TNieve.in:
            return `in`;
        case TNieve.cm:
        default:
            if (valor<100) {
                return `cm`;
            }
            return `m`;
    }
};

export function convertirNieve(value: number, from: TNieve, to: TNieve): number {
    switch (from) {
        case TNieve.cm:
            switch (to) {
                case TNieve.in:
                    return (value) / 2.54;
            }
            break;
        case TNieve.in:
            switch (to) {
                case TNieve.cm:
                    return value * 2.54;
            }
            break;
    }
    return value;
}

export function redondearNieve(value: number, unidad: TNieve): number {
    switch (unidad) {
        case TNieve.in:
            if (value < 1) {
                return Math.round(value * 10) / 10;
            }
            return Math.round(value);
        case TNieve.cm:
        default:
            return Math.round(value);
    }
}

export enum TPresion {
    mb      = 0,
    inhg    = 1,
    hpa     = 2,
    mmhg    = 3,
    kpa     = 4
}

export const PresionUnidad: Record<TPresion, string> = {
    [TPresion.mb]: "mb",
    [TPresion.inhg]: "inHg",
    [TPresion.hpa]: "hPa",
    [TPresion.mmhg]: "mmHg",
    [TPresion.kpa]: "kPa",
};

export function convertirPresion(value: number, from: TPresion, to: TPresion): number {
    switch (from) {
        case TPresion.mb:
            switch (to) {
                case TPresion.inhg:
                    return value / 33.8639;
                case TPresion.hpa:
                    return value;
                case TPresion.mmhg:
                    return value / 1.33322;
                case TPresion.kpa:
                    return value / 10;
            }
            break;
        case TPresion.inhg:
            switch (to) {
                case TPresion.mb:
                    return value * 33.8639;
                case TPresion.hpa:
                    return value * 33.8639;
                case TPresion.mmhg:
                    return value * 25.4;
                case TPresion.kpa:
                    return value * 3.38639;
            }
            break;
        case TPresion.hpa:
            switch (to) {
                case TPresion.mb:
                    return value;
                case TPresion.inhg:
                    return value / 33.8639;
                case TPresion.mmhg:
                    return value / 1.33322;
                case TPresion.kpa:
                    return value / 10;
            }
            break;
        case TPresion.kpa:
            switch (to) {
                case TPresion.mb:
                    return value * 10;
                case TPresion.inhg:
                    return value / 3.38639;
                case TPresion.hpa:
                    return value * 10;
                case TPresion.mmhg:
                    return value * 7.501;
            }
            break;
        default:
            switch (to) {
                case TPresion.mb:
                    return value * 1.33322;
                case TPresion.inhg:
                    return value * 25.4;
                case TPresion.hpa:
                    return value * 1.33322;
                case TPresion.kpa:
                    return value / 7.501;
            }
            break;
    }
    return value;
}

export function convertirVelocidad(value: number, from: TVelocidad, to: TVelocidad): number {
    switch (from) {
        case TVelocidad.KMH:
            switch (to) {
                case TVelocidad.MPH:
                    return value / VELOCIDAD_MPH_KHM;
                case TVelocidad.KNOTS:
                    return value * VELOCIDAD_KMH_KNOTS;
                case TVelocidad.MPS:
                    return value * VELOCIDAD_KMH_MPS;
                case TVelocidad.BEAUFORT:
                    if (value < 1) {
                        return 0;
                    }
                    if (value < 6) {
                        return 1;
                    }
                    if (value < 12) {
                        return 2;
                    }
                    if (value < 20) {
                        return 3;
                    }
                    if (value < 29) {
                        return 4;
                    }
                    if (value < 39) {
                        return 5;
                    }
                    if (value < 50) {
                        return 6;
                    }
                    if (value < 62) {
                        return 7;
                    }
                    if (value < 75) {
                        return 8;
                    }
                    if (value < 89) {
                        return 9;
                    }
                    if (value < 103) {
                        return 10;
                    }
                    if (value < 118) {
                        return 11;
                    }
                    return 12;
            }
            break;
        case TVelocidad.KNOTS:
            switch (to) {
                case TVelocidad.KMH:
                    return value / VELOCIDAD_KMH_KNOTS;
                case TVelocidad.MPH:
                    return value / VELOCIDAD_MPH_KNOTS;
                case TVelocidad.MPS:
                    return value * VELOCIDAD_KNOTS_MPS;
            }
            break;
        case TVelocidad.MPH:
            switch (to) {
                case TVelocidad.KMH:
                    return value * VELOCIDAD_MPH_KHM;
                case TVelocidad.KNOTS:
                    return value * VELOCIDAD_MPH_KNOTS;
                case TVelocidad.MPS:
                    return value * VELOCIDAD_MPH_MPS;
            }
            break;
        default:
            switch (to) {
                case TVelocidad.KMH:
                    return value / VELOCIDAD_KMH_MPS;
                case TVelocidad.KNOTS:
                    return value / VELOCIDAD_KNOTS_MPS
                case TVelocidad.MPH:
                    return value / VELOCIDAD_MPH_MPS;
            }
            break;
    }
    return value;
}

export enum TTemperatura {
    CENTIGRADOS = 1,
    FAHRENHEIT = 2,
}

export const TemperaturaUnidad: Record<TTemperatura, string> = {
    [TTemperatura.CENTIGRADOS]: "°C",
    [TTemperatura.FAHRENHEIT]: "°F",
};

export function convertirTemperatura(value: number, from: TTemperatura, to: TTemperatura): number {
    switch (from) {
        case TTemperatura.CENTIGRADOS:
            switch (to) {
                case TTemperatura.FAHRENHEIT:
                    return value * 1.8 + 32;
            }
            break;
        case TTemperatura.FAHRENHEIT:
            switch (to) {
                case TTemperatura.CENTIGRADOS:
                    return (value - 32) / 1.8;
            }
            break;
    }

    return value;
}

export enum TDistancia {
    METROS = 0,
    FEET = 1,
    KM = 2,
    HFEET = 3,
}

export const DistanciaUnidad: Record<TDistancia, string> = {
    [TDistancia.METROS]: "m",
    [TDistancia.FEET]: "ft",
    [TDistancia.KM]: "Km",
    [TDistancia.HFEET]: "hft",
};

export function convertirDistancia(value: number, from: TDistancia, to: TDistancia): number {
    switch (from) {
        case TDistancia.METROS:
            switch (to) {
                case TDistancia.FEET:
                    return value * 3.28084;
                case TDistancia.KM:
                    return value / 1000;
                case TDistancia.HFEET:
                    return (value * 3.28084) / 1000;
            }
            break;
        case TDistancia.FEET:
            switch (to) {
                case TDistancia.METROS:
                    return value / 3.28084;
                case TDistancia.KM:
                    return (value / 3.28084) / 1000;
                case TDistancia.HFEET:
                    return value / 100;
            }
            break;
        case TDistancia.KM:
            switch (to) {
                case TDistancia.FEET:
                    return (value / 1000) * 3.28084;
                case TDistancia.METROS:
                    return value / 1000;
                case TDistancia.HFEET:
                    return (value * 10) * 3.28084;
            }
            break;
        case TDistancia.HFEET:
            switch (to) {
                case TDistancia.METROS:
                    return (value / 3.28084) * 100;
                case TDistancia.KM:
                    return (value / 3.28084) / 10;
                case TDistancia.FEET:
                    return value * 100;
            }
            break;
    }

    return value;
}
