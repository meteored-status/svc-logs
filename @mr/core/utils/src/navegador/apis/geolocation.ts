/**
 * Editor: miguel
 * Fecha: Thu, 12 Nov 2026 11:34:11 GMT
 * Hash: 69c9ebdfef428aaac05bca909590677f
 * Versión: 2026.11.12+1-miguel
 * Anterior: 2026.6.18+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

export function requestGeolocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation no soportada"));
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
        });
    });
}

export async function getLocation(): Promise<GeolocationCoordinates | null> {
    try {
        const pos = await requestGeolocation();
        return pos.coords;
    } catch (err: unknown) {
        if (err instanceof GeolocationPositionError) {
            const mensajes: Record<number, string> = {
                1: "Permiso denegado por el usuario",
                2: "Posición no disponible",
                3: "Tiempo de espera agotado",
            };
            console.error(mensajes[err.code] ?? "Error desconocido");
        } else if (err instanceof Error) {
            console.error(err.message); // "Geolocation no soportada"
        }
        return null;
    }
}