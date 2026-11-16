/**
 * Editor: miguel
 * Fecha: Tue, 03 Nov 2026 07:22:11 GMT
 * Hash: 07aa697acaec9915517fcc9765ab538a
 * Versión: 2026.11.3+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

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
