/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 71bf8fca313ec542dd2e40ac9c7acc11
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

/**
 * Formatea una fecha como hora local `HH:MM:SS`.
 *
 * @param d - Fecha a formatear.
 * @returns Hora en formato `HH:MM:SS`.
 */
export function horaLocal(d: Date): string {
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map(n => String(n).padStart(2, "0"))
        .join(":");
}

/**
 * Formatea una fecha como fecha y hora local `YYYY-MM-DD HH:MM:SS`.
 *
 * @param d - Fecha a formatear.
 * @returns Fecha y hora en formato `YYYY-MM-DD HH:MM:SS`.
 */
export function fechaHoraLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return [
        `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
        horaLocal(d),
    ].join(" ");
}
