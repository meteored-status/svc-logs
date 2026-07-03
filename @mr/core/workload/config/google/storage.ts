/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: 61b8cbedb4ca3d77f8e042a28f2f40af
 * Versión: 2026.6.17+1-josantoniojimnez
 */

import {Configuracion, type IConfiguracion} from "@mr/core-utils/config";

/**
 * Interfaz de configuración de Google Cloud Storage para un servicio.
 *
 * @property credenciales - Ruta al fichero JSON de credenciales de la cuenta de servicio GCP
 *   (p.ej. `"files/credenciales/storage.json"`).
 * @property buckets      - Configuración tipada de los nombres de buckets. Opcional;
 *   si se omite, se usa un {@link Configuracion} vacío como placeholder.
 * @property package      - Nombre del paquete GCS raíz. Opcional.
 * @property subdir       - Subdirectorio dentro del bucket. Opcional.
 * @property subdir2      - Segundo nivel de subdirectorio. Opcional.
 *
 * @template T - Tipo concreto de configuración de buckets; debe extender {@link IConfiguracion}.
 */
export interface IGoogleStorage<T extends IConfiguracion=IConfiguracion> {
    credenciales: string;
    buckets?: T;
    package?: string;
    subdir?: string;
    subdir2?: string;
}

/**
 * Configuración resuelta de Google Cloud Storage.
 *
 * Aplica la fusión `user ?? defecto` sobre cada campo de {@link IGoogleStorage}.
 * Si no se proporciona `buckets`, se instancia un {@link Configuracion} vacío como
 * valor de relleno para mantener el tipo parametrizado.
 *
 * @template T - Tipo concreto de configuración de buckets; debe extender {@link Configuracion}.
 */
export class GoogleStorage<T extends Configuracion> implements IGoogleStorage {
    public readonly credenciales: string;
    public readonly buckets: T;
    public readonly package?: string;
    public readonly subdir?: string;
    public readonly subdir2?: string;

    /**
     * @param defecto - Valores de configuración de Storage por defecto.
     * @param user    - Sobreescrituras parciales leídas del fichero de config.
     * @param buckets - Instancia de buckets ya construida. Si se omite, se usa
     *   `new Configuracion({}, {})` casteado a `T` como placeholder vacío.
     */
    public constructor(defecto: IGoogleStorage, user: Partial<IGoogleStorage>, buckets?: T) {
        this.credenciales = user.credenciales??defecto.credenciales;
        this.buckets = buckets ?? new Configuracion({}, {}) as T;
        this.package = user.package??defecto.package;
        this.subdir = user.subdir??defecto.subdir;
        this.subdir2 = user.subdir2??defecto.subdir2;
    }
}
