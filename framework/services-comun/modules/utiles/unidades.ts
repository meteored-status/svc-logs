export enum TVelocidad {
    MPH = 1,
    KMH = 2,
    KNOTS = 3,
    MPS = 4,
    BEAUFORT = 5,
}

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

export enum TPresion {
    mb      = 0,
    inhg    = 1,
    hpa     = 2,
    mmhg    = 3
}

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
