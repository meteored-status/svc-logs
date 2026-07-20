/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 03 Jul 2026 07:46:10 GMT
 * Hash: a7fea9bc007b35dcd008a4226761c500
 * Versión: 2026.7.3+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
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
        return this.cargar<IConfiguracion, Configuracion>({});
    }
}
