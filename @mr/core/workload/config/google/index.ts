/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: e197bc5f51a66919430267e7d8207e29
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.6.17+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Configuracion} from "@mr/core-utils/config";
import {type IConfiguracion} from "@mr/core-utils/config";

import {GoogleStorage, type IGoogleStorage} from "./storage";

/**
 * Interfaz de configuración de Google Cloud para un servicio.
 *
 * @property id       - ID del proyecto de GCP (p.ej. `"api-project-858154548956"`). Opcional.
 * @property cliente  - Identificador de cliente de facturación de GCP. Opcional.
 * @property location - Región GCP por defecto (p.ej. `"europe-west1"`). Opcional.
 * @property storage  - Configuración de Google Cloud Storage (credenciales + buckets).
 *
 * @template T - Tipo concreto de configuración de buckets; debe extender {@link IConfiguracion}.
 */
export interface IGoogle<T extends IConfiguracion=IConfiguracion> {
    id?: string;
    cliente?: string;
    location?: string;
    storage: IGoogleStorage<T>;
}

/**
 * Configuración resuelta de Google Cloud para un servicio.
 *
 * Aplica la fusión `user ?? defecto` sobre cada campo de {@link IGoogle} y construye
 * un {@link GoogleStorage} con los buckets tipados.
 *
 * @template T - Tipo concreto de configuración de buckets; debe extender {@link Configuracion}.
 */
export class Google<T extends Configuracion=Configuracion> implements IGoogle {
    public readonly id: string;
    public readonly cliente: string;
    public readonly location: string;
    public readonly storage: GoogleStorage<T>;

    /**
     * @param defecto - Valores de configuración GCP por defecto.
     * @param user    - Sobreescrituras parciales leídas del fichero de config.
     * @param buckets - Instancia de buckets ya construida. Si se omite, se crea un
     *   {@link Configuracion} vacío como placeholder.
     */
    public constructor(defecto: IGoogle, user: Partial<IGoogle>, buckets?: T) {
        this.id = (user.id??defecto.id) ?? "";
        this.cliente = (user.cliente??defecto.cliente) ?? "";
        this.location = (user.location??defecto.location) ?? "";
        this.storage = new GoogleStorage<T>(defecto.storage??{
            credenciales: "",
            buckets: {},
        }, user.storage??{}, buckets);
    }
}
