/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: 73bf29e4622de5a00037506fbdab343d
 * Versión: 2026.8.21+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Marcado de logs de error como revisados.
 *
 * No se borra nada del índice: se pone `checked` a `true` y dejan de listarse, porque los listados llevan
 * `{checked: false}` cableado. De ahí el nombre — el botón de la pantalla sigue llamándose «borrar», pero
 * el endpoint, el permiso (`status.log.check`) y el apunte de auditoría (`check`) dicen lo que pasa: un
 * registro marcado se puede volver a consultar, y llamarlo borrado sería registrar en la auditoría una
 * desaparición que no ha ocurrido.
 *
 * `project` sigue viniendo en la petición —es qué se marca, no quién lo pide—, pero el backend comprueba
 * que sea uno de los del usuario antes de tocar nada. Antes esa comprobación la hacía el BFF del panel.
 *
 * @property project - Proyecto de los registros a marcar. Obligatorio: sin él se marcaría cualquier
 *                     proyecto. Sin nada más, se marca el proyecto entero — es el «limpiar todo» de la
 *                     pantalla.
 * @property ts      - Instante exacto del registro, en milisegundos.
 * @property service - Servicio del registro.
 * @property file    - Fichero del registro.
 * @property line    - Línea del registro.
 * @property url     - URL del registro.
 */
export interface ICheckIN {
    project: string;
    ts?: number;
    service?: string;
    file?: string;
    line?: number;
    url?: string;
}

/**
 * @property checked - Cuántos registros se han marcado. Se llama así y no `deleted` —como en el endpoint
 *                     equivalente de `svc-logs`— por lo mismo que el resto: es lo que ha pasado de verdad.
 */
export interface ICheckOUT {
    checked: number;
}
