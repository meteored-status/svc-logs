/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: fb9b4e297d39f53e285d482edd62f299
 * Versión: 2026.6.17+1-josantoniojimnez
 */

/**
 * Interfaz raíz de configuración para todos los paquetes del monorepo.
 *
 * No define propiedades propias: actúa como marca de tipo que permite construir
 * jerarquías seguras de configuración mediante herencia de interfaces.
 * Cualquier objeto plano vacío la satisface estructuralmente.
 */
export interface IConfiguracion {
    // base sin mayor repercusión
}

/**
 * Clase base genérica de configuración para todos los paquetes del monorepo.
 *
 * Almacena los valores por defecto (`defecto`) y las sobreescrituras del usuario
 * (`user`) en propiedades protegidas, de forma que las subclases puedan aplicar
 * la fusión `user ?? defecto` en sus propios constructores.
 *
 * ### Patrón de extensión
 *
 * ```ts
 * interface IMyConfig extends IConfiguracion {
 *     timeout: number;
 * }
 *
 * class MyConfig extends Configuracion<IMyConfig> {
 *     public readonly timeout: number;
 *
 *     public constructor(defecto: IMyConfig, user: Partial<IMyConfig>) {
 *         super(defecto, user);
 *         this.timeout = user.timeout ?? defecto.timeout;
 *     }
 * }
 * ```
 *
 * @template T - Tipo concreto de configuración; debe extender {@link IConfiguracion}.
 */
export class Configuracion<T extends IConfiguracion=IConfiguracion> implements IConfiguracion {
    protected defecto: T;
    protected user: Partial<T>;

    public constructor(defecto: T, user: Partial<T>) {
        this.defecto  = defecto;
        this.user = user;
    }
}
