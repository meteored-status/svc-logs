/**
 * Editor: miguel
 * Fecha: Tue, 03 Nov 2026 07:22:11 GMT
 * Hash: a19c17463e3ce9bfb934db0a7026ecea
 * Versión: 2026.11.3+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

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
