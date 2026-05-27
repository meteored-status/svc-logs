/**
 * Criterios de validación de un parámetro de query string.
 * Al menos uno de los criterios de tipo (`regex`, `exact`, `prefix`, `options`,
 * `cualquiera`) debe estar definido para que el parámetro sea evaluado;
 * si ninguno está presente, el parámetro se ignora.
 *
 * @property regex       - El valor debe coincidir con esta expresión regular.
 * @property exact       - El valor debe ser igual a esta cadena exacta.
 * @property prefix      - El valor debe comenzar con este prefijo.
 * @property options     - El valor debe pertenecer a este conjunto de cadenas permitidas.
 * @property cualquiera  - El valor debe tener al menos esta longitud mínima (en caracteres).
 * @property opcional    - Si `true`, el parámetro puede estar ausente sin que la validación falle. Por defecto `false`.
 * @property description - Descripción legible del parámetro; sin efecto en la validación.
 */
export interface IQuery {
    regex?: RegExp;
    exact?: string;
    prefix?: string;
    options?: string[];
    cualquiera?: number;
    opcional?: boolean;
    description?: string;
}

/**
 * Clase base abstracta para los validadores de parámetros de query string.
 * Cada subclase implementa {@link checkEjecutar} con una estrategia de validación concreta.
 *
 * El método público {@link check} acepta un array de valores (un parámetro puede
 * aparecer varias veces en la URL) y devuelve `true` solo si **todos** los valores
 * superan la validación.
 */
export abstract class Query {
    /** Indica si el parámetro puede estar ausente sin que la validación falle. */
    public readonly opcional: boolean;

    /**
     * @param key - Nombre del parámetro de query string que se va a validar.
     * @param obj - Criterios de validación y opciones del parámetro.
     */
    protected constructor(public key: string, obj: IQuery) {
        this.opcional = obj.opcional ?? false;
    }

    /**
     * Valida todos los valores recibidos para este parámetro.
     * - `0` valores → `false` (parámetro ausente).
     * - `1` valor   → delega directamente en {@link checkEjecutar}.
     * - `N` valores → `true` solo si **todos** superan {@link checkEjecutar}.
     *
     * @param parametro - Array de valores del parámetro tal como aparece en la query string.
     */
    public check(parametro: string[]): boolean {
        return parametro.length > 0 && parametro.every(p => this.checkEjecutar(p));
    }

    /**
     * Implementa la estrategia de validación específica de cada subclase.
     * Se invoca una vez por cada valor del parámetro.
     * @param param - Valor individual del parámetro a validar.
     */
    protected abstract checkEjecutar(param: string): boolean;
}
