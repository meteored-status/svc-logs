/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 03 Jul 2026 07:46:10 GMT
 * Hash: ca77c6febb81ce57c8fec0d41dfcbb88
 * Versión: 2026.7.3+1-josantoniojimnez
 * Anterior: 2026.5.27+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {ConfiguracionNet, type IConfiguracionNet} from "@mr/core-workload/config/net";

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
