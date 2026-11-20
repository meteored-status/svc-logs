/**
 * Editor: Bixus
 * Fecha: Wed, 18 Nov 2026 15:20:23 GMT
 * Hash: f2e7d0399e5fe564d0ebd90c4330180c
 * Versión: 2026.11.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Réplica mínima de `dd-trace` para el arnés de pruebas: sin traza activa. Lo usa `WSPool`
 * (`@mr/core-network/client/websocket`), que solo pregunta por el span activo para anotarlo.
 */

const tracer = {
    scope: () => ({active: () => null}),
    inject: () => undefined,
};

export const formats = {TEXT_MAP: "text_map"};

export default tracer;
