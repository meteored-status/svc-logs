/**
 * Editor: miguel
 * Fecha: Tue, 03 Nov 2026 07:22:11 GMT
 * Hash: 20f6dddb5de483842073d56fa666a65f
 * Versión: 2026.11.3+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

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
