/**
 * Editor: Bixus
 * Fecha: Wed, 26 Aug 2026 06:23:31 GMT
 * Hash: 599f65e7857b5ae5acb62780550f1a1a
 * Versión: 2026.8.26+1-bixus
 * Anterior: 2026.7.3+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Configuracion as ConfiguracionBase, type IConfiguracion as IConfiguracionBase} from "@mr/core-workload/config";

export interface IConfiguracion extends IConfiguracionBase {
}
export class Configuracion extends ConfiguracionBase<IConfiguracion> implements IConfiguracion {
    /* INSTANCE */
    public constructor(defecto: IConfiguracion, user: Partial<IConfiguracion>) {
        super(defecto, user);
    }

    /* STATIC */
    public static async load(): Promise<Configuracion> {
        return await this.cargar<IConfiguracion>({}) as Configuracion;
    }
}
