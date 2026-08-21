/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: 459bf0540801bd296201216097beb1f3
 * Versión: 2026.8.21+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Contrato de **almacenamiento** de los logs en Elasticsearch: cómo se llaman los índices y qué forma
 * tiene cada documento.
 *
 * Vive en el framework, y no en el servicio que escribe ni en el que lee, porque lo comparten los dos
 * repositorios del dominio: `svc-logs` es quien indexa (`logs-web`, vía `logs-services`) y
 * `svc-status` quien consulta (`status-backend`, para las pantallas de logs del panel). No hay índice
 * intermedio ni transformación: se lee exactamente lo que se escribió, así que cualquier cambio de
 * nombre de índice o de forma de documento rompe a los dos a la vez y tiene que verse en un solo sitio.
 *
 * Ojo: esto **no** es el contrato de los endpoints. Lo que se publica al panel son los `interface.ts` de
 * `logs/logs/*` y `status-backend/log/*`, con nombres en inglés; aquí los campos van en castellano
 * porque es el nombre de la columna en el índice, y renombrarlos sería una migración de datos.
 */

/**
 * Alias que agrupa los índices de logs de servicio (`mr-log-servicios-<proyecto>`).
 *
 * Se consulta el alias y no los índices: quien lee no tiene por qué saber que hay uno por proyecto, y el
 * filtro por proyecto va en la consulta igual —hace falta de todos modos, porque un usuario solo puede
 * ver los suyos—.
 */
export const LOG_SERVICIOS_ALIAS = "mr-log-servicios";

/**
 * Alias que agrupa los índices de logs de error (`mr-log-errores-<proyecto>`).
 */
export const LOG_ERRORES_ALIAS = "mr-log-errores";

/**
 * Documento de un log de servicio, tal y como está indexado.
 *
 * @property extra - Líneas extra del log. Puede llegar como cadena y no como lista: Elasticsearch no
 *                   distingue un valor de una lista de uno, así que un documento con un solo extra se
 *                   devuelve sin array. Quien lo lea tiene que normalizarlo.
 */
export interface ILogServicioES {
    "@timestamp": string;
    proyecto: string;
    servicio: string;
    tipo: string;
    severidad: string;
    mensaje: string;
    extra?: string|string[];
}

/**
 * Documento de un log de error, tal y como está indexado.
 *
 * @property checked - Si ya se ha revisado. Es el borrado del panel: los errores no se borran del índice,
 *                     se marcan, y los listados solo enseñan los que están a `false`.
 * @property linea   - Línea del fichero, **como cadena**: así la escribe la ingesta. Al publicarla se
 *                     convierte a número.
 * @property traza   - Traza de la pila; mismo aviso que `extra`, puede no venir como lista.
 * @property ctx     - Contexto de código alrededor del error; mismo aviso.
 */
export interface ILogErrorES {
    "@timestamp": string;
    checked: boolean;
    proyecto: string;
    servicio: string;
    url: string;
    mensaje: string;
    archivo: string;
    linea: string;
    traza?: string|string[];
    ctx?: ILogErrorCtxES|ILogErrorCtxES[];
}

/**
 * Línea de contexto de un log de error, tal y como está indexada.
 */
export interface ILogErrorCtxES {
    linea: number;
    codigo: string;
}
