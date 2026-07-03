/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: 085ab26dd116ccca4d06612ef02959da
 * Versión: 2026.6.17+1-josantoniojimnez
 */

import {Configuracion as ConfigGenerico, type IConfiguracion as IConfigGenerico} from "@mr/core-utils/config";
import {exists, readJSON} from "services-comun/modules/utiles/fs";

import {crearPodInfo, type IPodInfo} from "./pod";

/**
 * Extensión de `IConfiguracion` de `@mr/core-utils` que añade la información del pod.
 *
 * @property pod - Metadatos del pod resueltos en tiempo de arranque (host, servicio, zona,
 *   versión, replica, wire, deploy…). Se rellena automáticamente por {@link Configuracion.cargar};
 *   en el fichero de configuración se puede omitir.
 */
export interface IConfiguracion extends IConfigGenerico {
    pod?: IPodInfo;
}

/**
 * Clase base de configuración para todos los servicios del monorepo.
 *
 * Extiende {@link ConfigGenerico} (`@mr/core-utils`) añadiendo la propiedad `pod`
 * con los metadatos del pod resueltos en tiempo de arranque.
 *
 * ### Uso típico en un servicio
 *
 * Las subclases invocan `Configuracion.cargar(defecto)` desde su método `load()`:
 *
 * ```ts
 * class MiConfig extends Configuracion<IMiConfig> {
 *     public static async load(): Promise<MiConfig> {
 *         return this.cargar<IMiConfig>({
 *             timeout: 5000,
 *         }) as Promise<MiConfig>;
 *     }
 * }
 * ```
 *
 * @template T - Tipo concreto de configuración; debe extender {@link IConfiguracion}.
 */
export class Configuracion<T extends IConfiguracion=IConfiguracion> extends ConfigGenerico<T> implements IConfiguracion {
    /* STATIC */

    /**
     * Carga la configuración del servicio combinando los valores por defecto con las
     * sobreescrituras de `files/config.json` (si existe) y añadiendo la información
     * del pod resuelta en tiempo de arranque.
     *
     * Las dos lecturas (pod + fichero de config) se realizan en paralelo con
     * `Promise.all` para minimizar el tiempo de inicio.
     *
     * @param defecto - Valores por defecto de la configuración del servicio.
     */
    protected static async cargar<S extends IConfiguracion>(defecto: S): Promise<Configuracion<S>> {
        const [pod, cfg] = await Promise.all([
            crearPodInfo(),
            exists("files/config.json").then(
                existe=>existe?
                    readJSON<Partial<S>>("files/config.json"):
                    {}
            ),
        ]);
        return new this<S>({
            ...defecto,
            pod,
        }, cfg) as Configuracion<S>;
    }

    /* INSTANCE */

    /**
     * Metadatos del pod resueltos en tiempo de arranque (inmutables).
     * Incluye host, servicio, zona, versión, cronjob, sidecar, replica, wire y deploy.
     */
    public readonly pod: IPodInfo;

    public constructor(defecto: T, user: Partial<T>) {
        super(defecto, user);

        this.pod = defecto.pod!;
    }
}
