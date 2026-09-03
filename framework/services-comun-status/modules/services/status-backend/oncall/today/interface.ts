/**
 * Editor: Bixus
 * Fecha: Mon, 31 Aug 2026 10:21:12 GMT
 * Hash: 07b8b872c0e97b87122808488b4b8f0b
 * Versión: 2026.8.31+3-bixus
 * Anterior: 2026.8.26+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Quién está de guardia hoy, para el aviso del AppBar.
 *
 * Va en su propio endpoint y no en el payload del login por una razón concreta: la sesión se resuelve una
 * vez al entrar y el turno cambia a medianoche, así que alguien que dejase el panel abierto seguiría
 * viendo «Hoy estás de guardia» al día siguiente. Se pide al montar el layout, igual que hace
 * `CurrentStatus`.
 *
 * @property self  - Si **quien pregunta** está de guardia hoy. No lleva permiso: saber que te toca a ti es
 *                   tu propio dato, y es lo que dispara el aviso rojo.
 * @property requests - Cuántas solicitudes de cambio de guardia tiene **pendientes de responder**. Sin
 *                   permiso propio, por lo mismo que `self`: son suyas. Las que ha pedido él no cuentan —no
 *                   requieren nada de él—, así que el número es exactamente el de cosas que esperan una
 *                   respuesta suya.
 *
 *                   Viaja aquí y no en un endpoint propio porque este es **el endpoint de la cabecera**: lo
 *                   pide el layout en cada carga de página para el aviso de guardia, y el aviso de
 *                   solicitudes vive al lado. Un segundo endpoint sería una petición más por página para
 *                   traer un número.
 * @property users - Nombres de quienes están de guardia hoy. Va con **`status.oncall.view`** —o con
 *                   `status.oncall.list`, que es el permiso de administrar la rueda y ya los ve por otras
 *                   vías—, y
 *                   ausente cuando falta el permiso — no vacío, que se leería como «hoy no hay nadie de
 *                   guardia» en lugar de «no puedes verlo».
 *
 *                   `view` existe aparte de `list` porque enseñar un nombre en la cabecera no tiene por qué
 *                   costar el permiso de consultar la rueda entera: quién está dentro, en qué orden y a quién
 *                   le toca cada semana de los próximos dos años. Saber a quién avisar si algo se rompe le
 *                   sirve a cualquiera; administrar la guardia, no. Es una lista y no un nombre porque un festivo
 *                   dentro de una semana de guardia deja dos figuras implicadas y la columna `on_call` no
 *                   lleva `UNIQUE`.
 */
export interface ITodayOUT {
    self: boolean;
    requests: number;
    users?: string[];
}
