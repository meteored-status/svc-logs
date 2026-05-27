import {Configuracion, IConfiguracion} from "services-comun/modules/utiles/config";

import {type INet, Net} from "./net";
import type {Service} from "../service";

/**
 * Extensión de {@link IConfiguracion} que añade la configuración de red del servicio.
 *
 * @property net - Configuración de red resuelta (`INet`). Opcional en el fichero de
 *   configuración: si se omite, se obtiene automáticamente desde {@link Service}
 *   durante la construcción de {@link ConfiguracionNet}.
 */
export interface IConfiguracionNet extends IConfiguracion {
    net?: INet;
}

/**
 * Clase base de configuración para servicios que exponen un endpoint de red.
 * Extiende {@link Configuracion} añadiendo la propiedad `net` con la configuración
 * de puertos, endpoints, caché y timeouts resuelta para el entorno actual.
 *
 * ### Resolución de `net`
 * Si `defecto.net` no está definido en el fichero de configuración, se obtiene
 * automáticamente llamando a `services.configuracion(this.pod.servicio)`, que devuelve
 * la configuración de red del servicio actual registrada en {@link Service}.
 * Si tampoco se proporciona `services`, el constructor lanza un error.
 *
 * @template T - Tipo de configuración concreto, debe extender {@link IConfiguracionNet}.
 */
export class ConfiguracionNet<T extends IConfiguracionNet=IConfiguracionNet> extends Configuracion<T> implements IConfiguracionNet {
    public readonly net: Net;

    /**
     * @param defecto  - Valores por defecto de la configuración. Si `defecto.net` es
     *   `undefined`, se rellenará desde `services` antes de construir `Net`.
     * @param user     - Sobreescrituras parciales del usuario (leídas del fichero de config).
     * @param services - Registro de servicios del que se extrae la config de red cuando
     *   `defecto.net` no está definido. Obligatorio en ese caso.
     * @throws {Error} Si `defecto.net` es `undefined` y no se proporciona `services`.
     */
    protected constructor(defecto: T, user: Partial<T>, services?: Service) {
        super(defecto, user);

        if (!defecto.net && !services) {
            throw new Error("Parámetro SERVICES no definido");
        }

        this.net = new Net(defecto.net ?? services!.configuracion(this.pod.servicio), user.net ?? {});
    }
}
