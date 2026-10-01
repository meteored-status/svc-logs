/**
 * Editor: Bixus
 * Fecha: Mon, 14 Sep 2026 06:38:18 GMT
 * Hash: 45ebf901624abab63cfe7aee61943be2
 * Versión: 2026.9.14+2-bixus
 * Anterior: 2026.9.9+1-bixus
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
 * @property entorno   - Desde dónde se escribió: `0` desarrollo, `1` test, `2` producción (el `EEntorno`
 *                     de `@mr/core-log`). **Opcional, y hay que tratarlo como tal**: es un campo añadido
 *                     el 2026-09-08, así que no lo mandan los emisores que no usan `@mr/core-log`. Un log
 *                     sin entorno no es un log de desarrollo, es un log del que no se sabe.
 * @property severidad - `ESeverity`, numérico. **Se guardaba como cadena hasta el 2026-09-08**, herencia
 *                     de `logs-web`, y quien la leía hacía `parseInt`. Se cambió aprovechando que el data
 *                     stream estaba vacío; a los emisores que la siguen mandando como texto no les afecta,
 *                     porque Elasticsearch convierte las cadenas numéricas —y la ingesta la normaliza
 *                     antes, así que lo indexado es siempre un número.
 * @property region  - Dónde corría quien lo escribió: la zona del despliegue. **Opcional**, como `entorno`
 *                     y por lo mismo — es un campo añadido el 2026-09-14 y quien loguea desde un navegador
 *                     no tiene ninguna—. Un log sin región no es un log de ningún sitio, es uno del que no
 *                     se sabe.
 * @property host    - La máquina o el pod que lo escribió. Es lo que separa dos réplicas del mismo
 *                     servicio cuando solo una falla. Opcional por lo mismo que `region`.
 * @property extra   - Líneas extra del log. Puede llegar como cadena y no como lista: Elasticsearch no
 *                     distingue un valor de una lista de uno, así que un documento con un solo extra se
 *                     devuelve sin array. Quien lo lea tiene que normalizarlo.
 */
export interface ILogServicioES {
    "@timestamp": string;
    entorno?: number;
    proyecto: string;
    servicio: string;
    region?: string;
    host?: string;
    tipo: string;
    severidad: number;
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
