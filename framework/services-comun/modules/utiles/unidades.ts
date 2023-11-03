export enum TVelocidad {
    MPH = 1,
    KMH = 2,
    KNOTS = 3,
    MPS = 4,
}

const VELOCIDAD_MPH_KHM = 1.609346;
const VELOCIDAD_MPH_KNOTS = 0.868977;
const VELOCIDAD_KMH_KNOTS = 0.539957;
const VELOCIDAD_KMH_MPS = 0.277778;
const VELOCIDAD_KNOTS_MPS = 0.514444;
const VELOCIDAD_MPH_MPS = 0.44704;

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
