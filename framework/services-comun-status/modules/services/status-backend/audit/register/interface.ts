/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: 5e4887d11e4b2319de5ab77270d77def
 * Versión: 2026.8.21+1-bixus
 * Anterior: 2026.8.20+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Acceso a registrar en la auditoría.
 *
 * Solo viaja la ruta: **quién** accede no lo dice el cliente, lo resuelve el backend a partir del token
 * de la petición. Si el usuario viniera en el payload, cualquiera con sesión podría escribir accesos a
 * nombre de otro y la auditoría dejaría de valer como tal.
 *
 * Tampoco viaja la acción, por lo mismo: este endpoint anota siempre un `EAuditAction.NAVIGATE` y no lee
 * ninguna del payload. Las demás acciones (`edit`, `delete`) las registra el backend cuando las
 * ejecuta —después de que hayan pasado de verdad—, así que no hay forma de inventarse un borrado que
 * nunca ocurrió ni de anotar una visita como si fuera otra cosa.
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
