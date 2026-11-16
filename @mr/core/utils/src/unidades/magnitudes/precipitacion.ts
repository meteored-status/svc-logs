/**
 * Editor: miguel
 * Fecha: Tue, 03 Nov 2026 07:22:11 GMT
 * Hash: fdb2782c6bc26095f369e99d5d3f314b
 * Versión: 2026.11.3+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

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
