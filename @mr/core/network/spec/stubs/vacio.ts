/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 8bc4ac6db6a622fb436f3f0351a450b9
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Sustituto de los módulos que el código bajo prueba importa pero estas pruebas no usan (`fs`, `stream`,
 * `@mr/core-i18n/langs`): cualquier propiedad es una función que no hace nada.
 */
const vacio: unknown = new Proxy({}, {
    get: (_destino, propiedad) => propiedad === "__esModule" ? false : () => undefined,
});

export {};
module.exports = vacio;
