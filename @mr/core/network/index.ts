/**
 * Tipo base devuelto por todos los métodos de red del monorepo,
 * tanto sobre WebSocket como sobre HTTP.
 *
 * @template T - Tipo del payload de negocio. Lo declara el consumidor en cada llamada.
 *
 * @property data - Payload de la respuesta.
 * @property expires - Timestamp Unix (ms) a partir del cual la respuesta se considera
 *   expirada a efectos de caché. Ausente si el servidor no indica TTL.
 * @property buffer - Frame binario adjunto. Solo presente en respuestas WebSocket
 *   cuando el servidor envía `buffer: true` junto al mensaje JSON.
 */
export interface IResponse<T> {
    data: T;
    expires?: number;
    buffer?: ArrayBuffer;
}
