/**
 * Editor: Bixus
 * Fecha: Thu, 13 Aug 2026 11:53:20 GMT
 * Hash: cb916f8e1e11f823c5331aa7992ea0cc
 * Versión: 2026.8.13+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Departamento a borrar. El borrado es **físico**: la fila desaparece, así que solo se permite si el
 * departamento no está en uso — sin miembros, sin servicios y sin logs—. Las cuatro claves ajenas que
 * apuntan a `department(id)` lo impedirían de todos modos, pero el flow lo comprueba antes para poder
 * decir el motivo.
 *
 * @property id - Identificador del departamento.
 */
export interface IDeleteIN {
    id: number;
}
