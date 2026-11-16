/**
 * Editor: miguel
 * Fecha: Tue, 03 Nov 2026 07:22:11 GMT
 * Hash: 787ecd8d77ac09fd95f64a9e409b9c30
 * Versión: 2026.11.3+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

export enum TDistancia {
    METROS = 0,
    FEET = 1,
    KM = 2,
    HFEET = 3,
    MILLAS = 4,
}

export const DistanciaUnidad: Record<TDistancia, string> = {
    [TDistancia.METROS]: "m",
    [TDistancia.FEET]: "ft",
    [TDistancia.KM]: "Km",
    [TDistancia.HFEET]: "hft",
    [TDistancia.MILLAS]: "mi",
};

export function convertirDistancia(value: number, from: TDistancia, to: TDistancia): number {
    switch (from) {
        case TDistancia.METROS:
            switch (to) {
                case TDistancia.MILLAS:
                    return value / 1609.344;
                case TDistancia.FEET:
                    return value * 3.28084;
                case TDistancia.KM:
                    return value / 1000;
                case TDistancia.HFEET:
                    return (value * 3.28084) / 100;
            }
            break;
        case TDistancia.FEET:
            switch (to) {
                case TDistancia.MILLAS:
                    return value / 5280;
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
                case TDistancia.MILLAS:
                    return value / 1.609344;
                case TDistancia.FEET:
                    return (value * 1000) * 3.28084;
                case TDistancia.METROS:
                    return value * 1000;
                case TDistancia.HFEET:
                    return (value * 10) * 3.28084;
            }
            break;
        case TDistancia.HFEET:
            switch (to) {
                case TDistancia.MILLAS:
                    return value / 52.8;
                case TDistancia.METROS:
                    return (value / 3.28084) * 100;
                case TDistancia.KM:
                    return (value / 3.28084) / 10;
                case TDistancia.FEET:
                    return value * 100;
            }
            break;
        case TDistancia.MILLAS:
            switch (to) {
                case TDistancia.METROS:
                    return value * 1609.344;
                case TDistancia.FEET:
                    return value * 5280;
                case TDistancia.KM:
                    return value * 1.609344;
                case TDistancia.HFEET:
                    return value * 52.8;
            }
            break;
    }

    return value;
}
