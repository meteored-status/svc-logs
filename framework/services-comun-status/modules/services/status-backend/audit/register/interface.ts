/**
 * Editor: Bixus
 * Fecha: Thu, 20 Aug 2026 06:26:03 GMT
 * Hash: 94e049da0ede920b06928cfc3a74a76e
 * Versión: 2026.8.20+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Acceso a registrar en la auditoría.
 *
 * Solo viaja la ruta: **quién** accede no lo dice el cliente, lo resuelve el backend a partir del token
 * de la petición. Si el usuario viniera en el payload, cualquiera con sesión podría escribir accesos a
 * nombre de otro y la auditoría dejaría de valer como tal.
 *
 * @property path - Ruta visitada dentro del panel, con su query string si la tiene (`/manager/users`,
 *                  `/logs?service=3`). Se registra tal cual llega, normalizada por el backend: sin
 *                  origen —el panel es un único dominio— y siempre con `/` inicial.
 */
export interface IRegisterIN {
    path: string;
}

/**
 * Confirmación del acceso registrado.
 *
 * @property timestamp - Instante con el que quedó anotado, en milisegundos. Lo pone el backend con su
 *                       reloj y no el cliente: en una auditoría la hora no la elige el auditado.
 */
export interface IRegisterOUT {
    timestamp: number;
}
