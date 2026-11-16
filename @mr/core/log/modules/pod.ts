/**
 * Editor: Bixus
 * Fecha: Mon, 14 Sep 2026 06:38:18 GMT
 * Hash: c602dd25d45a1d84a6d6c90bbfb07c3f
 * Versión: 2026.9.14+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {type ILoggerConfig, Logger} from "./logger";
import type {IOrigen} from "./interface";

/**
 * Montar el logger de un servicio que corre en un pod, que es lo que hacen todos menos el navegador.
 *
 * **Vive aparte de `logger.ts` porque lee `process.env`**, y aquel tiene que poder cargarse en el
 * navegador —lo vigila `tsconfig.browser.json`, que lista sus ficheros uno a uno y no incluye este—. Es la
 * misma separación que ya había entre `destino/http` y `destino/websocket`: lo que no es de Node se queda
 * donde lo puede usar todo el mundo.
 *
 * Lo que se saca de aquí no es una comodidad, es **una sola versión de una convención de la casa**. El
 * nombre con el que se firma un servicio lo componen hoy tres sitios por su cuenta —el `run.sh` del
 * `Dockerfile` para Datadog, y los prefijos de clave de redis y de valkey—, y cada emisor de logs que se
 * añada sería un cuarto. Con esto, el cuarto es una línea.
 */

/**
 * El nombre con el que se firma el servicio: `<namespace>/<servicio>` dentro de Kubernetes, y el servicio a
 * secas fuera.
 *
 * El namespace delante **no es decoración**: el mismo servicio corre en varios clústeres y namespaces, y
 * sin él dos procesos de sitios distintos se leen como si fueran el mismo.
 *
 * **Lo primero que se mira es `DD_SERVICE`, porque dentro del pod ya viene compuesto.** El `run.sh` que
 * genera el `Dockerfile` del despliegue lo reescribe a `${K8S_NAMESPACE:-default}/${DD_SERVICE}` —con
 * `meteored` abreviado a `mr`— justo antes de arrancar el proceso, así que el valor que se quiere ya está
 * hecho, y hecho por la plataforma. Cogerlo en vez de rehacerlo tiene dos ventajas: el servicio se llama
 * igual en los logs y en Datadog, y si cambia la convención cambia en el `Dockerfile` y aquí no hay nada
 * que tocar.
 *
 * El respaldo compone lo mismo a mano con `K8S_NAMESPACE` —el propio `Dockerfile` contempla que
 * `DD_SERVICE` falte, con su `[ -n … ]`— y el nombre que trae el pod. `replaceAll` y no `replace` porque el
 * `sed` de allí lleva `/g`.
 *
 * Y sin ninguna de las dos, el nombre a secas. Ahí **no** se copia el `default` del `Dockerfile`: sin
 * namespace no hay Kubernetes, y firmar los logs de una ejecución local como `default/…` sería inventarse
 * un sitio del que no vienen. Con `DD_SERVICE`, en cambio, sí puede salir `default/…`, y está bien que
 * salga: eso lo ha decidido la plataforma y no nosotros.
 *
 * **Se mira la longitud y no `??`**, y no es purismo: que una de las dos variables esté *definida y vacía*
 * es justo lo que pasa cuando el despliegue la declara sin valor, y `??` solo cae al respaldo con `null` o
 * `undefined`. Con `??`, un `DD_SERVICE=""` firmaba **todos** los logs con el servicio en blanco.
 *
 * @param pod De dónde sale el servicio; el `IPodInfo` de `@mr/core-workload` encaja tal cual.
 */
export function servicioDePod(pod: IOrigen): string {
    const datadog = process.env["DD_SERVICE"] ?? "";
    if (datadog.length > 0) {
        return datadog;
    }

    const namespace = (process.env["K8S_NAMESPACE"] ?? "").replaceAll("meteored", "mr");

    return namespace.length > 0 ? `${namespace}/${pod.servicio}` : pod.servicio;
}

/**
 * Configuración de {@link loggerDePod}: la de siempre, pero con el `pod` obligatorio y sin los tres campos
 * que salen de él.
 */
export interface ILoggerPodConfig extends Omit<ILoggerConfig, "pod"|"servicio"|"region"|"host"> {
    pod: IOrigen;
}

/**
 * El logger de un servicio, montado con lo que ya dice su pod: el nombre con el que se firma, la zona y la
 * máquina.
 *
 * Es lo que evita que cada servicio repita el mismo puñado de líneas —y, peor, que las repita distinto—.
 * Un emisor queda en:
 *
 * ```ts
 * const log = loggerDePod({pod: configuracion.pod, proyecto: "MI-PROYECTO", destinos: [new DestinoHTTP()]});
 * ```
 *
 * Ojo con `host` fuera del clúster: `crearPodInfo()` solo usa `os.hostname()` en producción y fuera pone el
 * primer servicio del kustomize, así que en local no es el nombre de la máquina. Es lo mismo que enseña el
 * resto del servicio, y tenerlo distinto solo en los logs sería peor que tenerlo pobre.
 */
export function loggerDePod({pod, ...config}: ILoggerPodConfig): Logger {
    return Logger.build({
        ...config,
        pod,
        servicio: servicioDePod(pod),
    });
}
