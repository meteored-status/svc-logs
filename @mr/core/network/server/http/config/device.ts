/**
 * Tipo de dispositivo del cliente detectado a partir del `User-Agent` de la petición HTTP.
 *
 * - `unknown` — No se pudo identificar el dispositivo.
 * - `desktop` — Navegador de escritorio (Windows, macOS, Linux).
 * - `mobile`  — Navegador móvil (smartphone).
 * - `tablet`  — Navegador de tablet.
 */
export enum TDevice {
    unknown,
    desktop,
    mobile,
    tablet,
}
