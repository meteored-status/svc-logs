export interface ICoordenadas {
    lon: number;
    lat: number;
}

export interface IGeoPoint {
    "type": "Point",
    "coordinates": [number, number];
}

export class Coordenadas {
    private static parseSeconds(seconds: string): number {
        const len = seconds.length-2;
        const divisor = 3600*(10**len);
        return parseInt(seconds) / divisor;
    }

    protected static parseLatitudWGS84(lat: string): number {
        const orientacion = lat.slice(0, 1) == "N" ? 1 : -1;
        const grados = parseInt(lat.slice(1, 3));
        const minutos = parseInt(lat.slice(3, 5));
        const sec = lat.slice(5);

        return (grados + minutos/60 + this.parseSeconds(sec)) * orientacion;
    }

    protected static parseLongitudWGS84(lon: string): number {
        const orientacion = lon.slice(0, 1) == "E" ? 1 : -1;
        const grados = parseInt(lon.slice(1, 4));
        const minutos = parseInt(lon.slice(4, 6));
        const sec = lon.slice(6);

        return (grados + minutos/60 + this.parseSeconds(sec)) * orientacion;
    }

    public static parseWGS84(lat: string, lon: string): ICoordenadas {
        return {
            lat: this.parseLatitudWGS84(lat),
            lon: this.parseLongitudWGS84(lon),
        }
    }
}

export function rad(x: number): number {
    return x * Math.PI / 180;
}

/**
 * Calcula la distancia en kilómetros entre dos puntos.
 * @param a Punto A.
 * @param b Punto B.
 */
export function distanceKm(a: ICoordenadas, b: ICoordenadas): number {
    const rLat: number = rad(b.lat - a.lat);
    const rLon: number = rad(b.lon - a.lon);
    const ap: number = Math.sin(rLat/2) * Math.sin(rLat/2) + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rLon/2) * Math.sin(rLon/2);
    const cp = 2 * Math.atan2(Math.sqrt(ap), Math.sqrt(1-ap));
    return 6378.137 * cp;
}

/**
 * Indica si un punto está cerca de otro dado un radio de búsqueda.
 * @param a Punto A.
 * @param b Punto B.
 * @param r Radio en kilómetros.
 */
export function near(a: ICoordenadas, b: ICoordenadas, r: number): boolean {
    return distanceKm(a, b) <= r;
}

/**
 * Exporta unas coordenadas al lado positivo o negativo.
 * @param lat Latitud original.
 * @param lon Longitud original.
 * @param rl True si se debe trasladar al lado derecho o false si se traslada al lado izquierdo.
 * @param ud True si se debe trasladar al lado superior o false si se traslada al lado inferior.
 */
export function plain(lat: number, lon: number, rl?: boolean, ud?: boolean): ICoordenadas {
    let nLon: number = lon;
    let nLat: number = lat;

    if (rl !== undefined) {
        if (rl && lon < 0) {
            const abs: number = Math.abs(-180 - lon);
            nLon = 180 + abs;
        } else if (!rl && lon >= 0) {
            const abs: number = Math.abs(180 - lon);
            nLon = -180 - abs;
        }
    }

    if (ud !== undefined) {
        if (ud && lat < 0) {
            const abs: number = Math.abs(-90 - lat);
            nLat = 90 + abs;
        } else if (!ud && lat >= 0) {
            const abs: number = Math.abs(90 - lat);
            nLat = -90 - abs;
        }
    }

    return {
        lat: nLat,
        lon: nLon,
    };
}
