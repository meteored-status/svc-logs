/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:11 GMT
 * Hash: fce7e9522afb68670476057e3a72496f
 * Versión: 2026.11.11+1-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

/**
 * Tipos de una ruta, para la documentación OpenAPI generada (`mrpack autodoc`).
 *
 * @property post     - Tipo del cuerpo de la petición.
 * @property response - Tipo de `data` en la respuesta correcta (no del envoltorio `{ok, expiracion, data}`).
 * @property query    - Tipo de los parámetros de query.
 * @property headers  - Tipo de las cabeceras.
 */
export interface IContractTypes {
    post?: unknown;
    response?: unknown;
    query?: unknown;
    headers?: unknown;
}

/**
 * Parte de un contrato que sí existe en tiempo de ejecución (y se lee del literal).
 *
 * @property errors      - Códigos HTTP de error que puede devolver la ruta.
 * @property description - Descripción de la operación.
 * @property envelope    - `false` si la ruta responde sin el envoltorio `{ok, expiracion, data}` (respuesta cruda).
 */
export interface IContractConfig {
    errors?: number[];
    description?: string;
    envelope?: boolean;
}

/**
 * Contrato de una ruta: sus tipos y su configuración documental.
 *
 * @template T - Tipos de la ruta ({@link IContractTypes}).
 * @property types - Propiedad fantasma: nunca tiene valor, solo lleva `T` en el tipo para que el generador de
 *   documentación lo lea con el type checker.
 */
export interface IContract<T extends IContractTypes = IContractTypes> extends IContractConfig {
    readonly types?: T;
}

/**
 * Asocia tipos TypeScript a una ruta para que `mrpack autodoc` los documente. No hace nada en tiempo de
 * ejecución: devuelve una copia de `config`. Se usa en el campo `contract` de `IExpresion` o de `IRouteGroup`.
 *
 * @example
 * ```ts
 * contract: Contract<{post: IRegisterIN; response: IRegisterOUT}>({errors: [400, 401, 500]})
 * ```
 *
 * @template T - Tipos de la ruta ({@link IContractTypes}).
 * @param config - Códigos de error, descripción y envoltorio.
 */
export function Contract<T extends IContractTypes>(config: IContractConfig = {}): IContract<T> {
    return {...config};
}
