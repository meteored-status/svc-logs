/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: cb36da3a3cebf125081aa6ed2cee2fad
 * Versión: 2026.5.27+1-josantoniojimnez
 */

/**
 * Clase base abstracta para todos los plugins del sistema.
 * Define el ciclo de vida `start`/`stop` que deben implementar los plugins concretos.
 */
export abstract class PluginTemplate<T> {
    public abstract name: string;
    public abstract version: string;

    protected constructor(public readonly app: T) {
    }

    /**
     * Inicia el plugin y establece su estado activo.
     *
     */
    public abstract start(): Promise<void>;

    /**
     * Detiene el plugin y libera sus recursos.
     *
     */
    public abstract stop():  Promise<void>;
}
