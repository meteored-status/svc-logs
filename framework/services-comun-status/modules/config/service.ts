/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 4f94cfe452448a9974af28ecf342270d
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import {
    ConfiguracionNet,
    type IConfiguracionNet,
} from "@mr/core-network/server/http/config/config";

import {SERVICES} from "../services/config";

export interface IConfiguracion extends IConfiguracionNet {
}
export class Configuracion<T extends IConfiguracion = IConfiguracion> extends ConfiguracionNet<T> implements IConfiguracion {
    /* INSTANCE */
    public constructor(defecto: T, user: Partial<T>) {
        super(defecto, user, SERVICES);
    }

    /* STATIC */
    public static async load(): Promise<Configuracion> {
        return await this.cargar<IConfiguracion>({}) as Configuracion;
    }
}
