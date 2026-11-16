/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 321d0ba295daaa24b41098139aa98f26
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.14+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * El vocabulario del logging de servicios: qué es un log, con qué severidad, y qué forma tiene cuando sale
 * por el cable.
 */

/**
 * Severidad de un log de servicio.
 *
 * **Los números son el contrato, no los nombres.** Quien lee estos logs —el panel de status— los recibe
 * como `ESeverity`, un enum numérico, y los pinta y los filtra por ese número. En el índice, en cambio, la
 * severidad está guardada como **cadena**, y quien la lee hace `Number.parseInt(severidad, 10) || 0`: una
 * severidad que no sea un número se convierte en `0` sin fallar, o sea que un log mandado como `"error"`
 * aparece en el panel como informativo y nadie se entera.
 *
 * De ahí que esto sea un enum numérico y que serializar sea cosa del destino y no de quien loguea.
 */
export enum ESeveridad {
    INFO     = 0,
    WARNING  = 1,
    ERROR    = 2,
    CRITICAL = 3,
}

/**
 * Entorno desde el que se escribe el log.
 *
 * Numérico, como {@link ESeveridad} y por el mismo motivo —el panel filtra por valores, no por texto—,
 * pero **sin repetir su error**: la severidad viaja como cadena porque así se indexó hace años y ya no se
 * puede cambiar sin migrar el índice; esto es campo nuevo y viaja como número.
 */
export enum EEntorno {
    DESARROLLO = 0,
    TEST       = 1,
    PRODUCCION = 2,
}

/**
 * El entorno en el que se está ejecutando, deducido de las constantes que inlina el bundler.
 *
 * Se mira `TEST` primero **porque test también es producción**: el contrato de `@mr/core-dev` es
 * producción `PRODUCCION=true, TEST=false`, test `PRODUCCION=true, TEST=true`, y desarrollo las dos a
 * `false`. Preguntar por `PRODUCCION` antes daría `PRODUCCION` en test.
 *
 * Los `typeof` no son adorno: estas constantes las inlina el bundler, y este paquete puede ejecutarse sin
 * pasar por él —sus propias pruebas, sin ir más lejos—, donde el identificador sencillamente no existe y
 * leerlo sería un `ReferenceError`. Cuando sí las inlina no cuestan nada: `typeof true` se pliega en
 * tiempo de compilación y la rama muerta desaparece igual.
 */
export function entornoActual(): EEntorno {
    if (typeof TEST !== "undefined" && TEST) {
        return EEntorno.TEST;
    }
    if (typeof PRODUCCION !== "undefined" && PRODUCCION) {
        return EEntorno.PRODUCCION;
    }

    return EEntorno.DESARROLLO;
}

/**
 * De dónde sale un servicio, en los tres datos que el logger pone en cada log.
 *
 * **Es la forma del `IPodInfo` de `@mr/core-workload`, a propósito, y no una importación suya.** Ese tipo
 * lo resuelve `crearPodInfo()` leyendo `package.json`, `mrpack.json`, `os.hostname()` y `process.env`, y
 * cualquier servicio del monorepo lo tiene a mano en su configuración; pero importarlo aquí metería
 * `node:os` y `services-comun` en un paquete que **tiene que poder cargarse en el navegador** (lo vigila
 * `tsconfig.browser.json`). Declarando solo lo que se necesita, un `IPodInfo` encaja sin más —TypeScript
 * es estructural— y el paquete no se entera de que existe `@mr/core-workload`.
 *
 * @property servicio - Nombre del servicio.
 * @property zona     - Zona del despliegue. Es lo que se apunta como `region`.
 * @property host     - Máquina o pod.
 */
export interface IOrigen {
    servicio: string;
    zona: string;
    host: string;
}

/**
 * Un log, tal y como lo escribe quien loguea.
 *
 * @property tipo      - Categoría del log, libre. En el panel es un filtro con lista de valores —se saca
 *                       de los propios documentos con una agregación—, así que conviene un puñado corto de
 *                       valores estables por servicio y no una frase distinta cada vez.
 * @property mensaje   - El texto del log.
 * @property severidad - Por defecto {@link ESeveridad.INFO}.
 * @property extra     - Líneas adicionales. Ojo al leerlas de vuelta: Elasticsearch no distingue un valor
 *                       de una lista de uno, así que un log con un solo `extra` se devuelve sin array.
 * @property timestamp - Momento del log en milisegundos. Por defecto, cuando se llama a `Logger`. Se manda
 *                       siempre, y eso importa: entre que se escribe un log y llega a destino puede haber
 *                       una reconexión por medio, y sin este campo el registro quedaría fechado a la
 *                       llegada.
 */
export interface ILog {
    tipo: string;
    mensaje: string;
    severidad?: ESeveridad;
    extra?: string[];
    timestamp?: number;
}

/**
 * Un log ya completo: lo que escribió quien loguea más lo que pone el {@link Logger} y es igual para todos
 * sus logs. Es lo que recibe cada destino.
 *
 * @property region - Dónde corre el proceso. **Opcional**: no todo emisor sabe de una región —el navegador,
 *                    sin ir más lejos— y un valor inventado sería peor que no tenerlo.
 * @property host   - Qué máquina o pod lo escribió. Opcional por lo mismo.
 */
export interface ILogEmitido extends Required<Omit<ILog, "extra">> {
    proyecto: string;
    servicio: string;
    entorno: EEntorno;
    region?: string;
    host?: string;
    extra?: string[];
}

/**
 * El log de servicio **tal y como viaja**: el cuerpo que acepta la ingesta de `status-external`, tanto por
 * `POST /service/logs/service/` como por el método WebSocket `/logs/service/`.
 *
 * Es el contrato entre quien loguea y quien indexa, y vive aquí porque este paquete es el lado emisor y lo
 * usan servicios de proyectos que no tienen nada del dominio status. El receptor lo importa de aquí: no
 * puede ser al revés, porque `@mr/core-*` es lo que todos tienen y `services-comun-status` no.
 *
 * @property timestamp - **Opcional, y no por comodidad.** Quien emite con este paquete lo pone siempre,
 *                       pero llevan años entrando logs por HTTP de emisores que no lo mandan, y el
 *                       receptor los construye con un `as` sobre el cuerpo sin validar: darlo por
 *                       obligatorio sería el tipo mintiendo sobre lo que de verdad llega. Sin él se indexa
 *                       la hora de llegada.
 * @property entorno   - Opcional por lo mismo que `timestamp`: quien emite con este paquete lo pone
 *                       siempre, pero los emisores de antes no lo conocen. Cuando no viene no se indexa,
 *                       que es mejor que inventárselo — un log sin entorno se distingue de uno de
 *                       desarrollo. Ver {@link EEntorno}.
 * @property severidad - Numérica. Se guardaba como cadena con un número dentro —herencia de `logs-web`—
 *                       hasta que se cambió aprovechando que el índice estaba vacío. Los emisores que la
 *                       siguen mandando como texto no se rompen: la ingesta la normaliza. Ver
 *                       {@link ESeveridad}.
 * @property region    - Dónde corre quien escribe: la zona o región del despliegue. **Opcional y sin valor
 *                       por defecto**, como `host`. El mismo servicio corre en varios clusteres, y sin esto
 *                       dos pasadas de sitios distintos se leen igual; pero quien loguea desde un navegador
 *                       no tiene región ninguna, así que inventarle una sería mentir en el registro.
 * @property host      - Qué máquina o pod lo escribió. Es lo que separa dos réplicas del mismo servicio
 *                       cuando solo una falla, que es justo cuando hace falta saberlo. Opcional por lo
 *                       mismo que `region`.
 * @property extra     - Al leerlo de vuelta, ojo: Elasticsearch no distingue un valor de una lista de uno,
 *                       así que un documento con un solo `extra` se devuelve sin array.
 */
export interface IWire {
    timestamp?: number;
    entorno?: EEntorno;
    proyecto: string;
    servicio: string;
    region?: string;
    host?: string;
    tipo: string;
    severidad: ESeveridad;
    mensaje: string;
    extra?: string[];
}

/**
 * A dónde va un log: consola, Datadog, la ingesta remota… Por ahora solo hay uno,
 * `@mr/core-log/destino/websocket`.
 *
 * **`enviar()` no devuelve nada y no puede lanzar.** Las dos cosas son la misma decisión: un log es un
 * efecto secundario de lo que el servicio esté haciendo de verdad, y un destino caído no puede ni tumbar ni
 * frenar a quien escribe. Un destino que no pueda entregar tiene que apañárselas por dentro —descartar,
 * reintentar, avisar por consola— y devolver igual.
 *
 * @property vaciar - Entregar lo que quede pendiente. El destino **sigue utilizable** después.
 *     Existe por los cronjobs, que se mueren en cuanto terminan su trabajo: un destino que agrupe o
 *     encole se lleva por delante lo último que se escribió, que suele ser precisamente el resultado. Un
 *     destino sin nada que vaciar no necesita implementarlo.
 * @property cerrar - Vaciar lo pendiente y soltar recursos. Lo llama el apagado del servicio, no cada log.
 */
export interface IDestino {
    enviar(log: ILogEmitido): void;
    vaciar?(): Promise<void>;
    cerrar?(): Promise<void>;
}
