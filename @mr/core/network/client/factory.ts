import {info} from "services-comun/modules/browser/log";

/**
 * Entrada interna del mapa de caché.
 * @template T - Tipo del dato cacheado.
 * @property data - Promesa en curso (o ya resuelta) con el dato y su expiración.
 * @property timeout - Referencia al temporizador que eliminará la entrada cuando expire.
 *   `undefined` mientras la promesa no se ha resuelto o el temporizador ya disparó.
 */
export interface IFactoryCache<T> {
    data: Promise<IFactoryExpires<T>>;
    timeout?: NodeJS.Timeout;
}

/**
 * Resultado devuelto por la función de carga (`fn`) y por {@link factoryCache}.
 * @template T - Tipo del dato obtenido.
 * @property data - Valor del recurso cargado.
 * @property expires - Timestamp Unix (ms) a partir del cual la entrada se considera expirada.
 */
export interface IFactoryExpires<T> {
    data: T;
    expires: number;
}

type TCache<T> = Record<string, IFactoryCache<T>>;
type TFactoryExec<T> = ()=>Promise<IFactoryExpires<T>>

/**
 * Parámetros de entrada para {@link factoryCache}.
 * @template T - Tipo del dato gestionado.
 * @property nombre - Nombre descriptivo del recurso; aparece en el log de tiempos de carga.
 * @property cache - Mapa compartido donde se almacenan las entradas activas.
 * @property key - Clave única que identifica esta entrada dentro de `cache`.
 * @property fn - Función que carga el dato y devuelve su timestamp de expiración.
 * @property defaultTimeout - Duración personalizada del temporizador de expiración (ms).
 *   Si se omite, se usa `expires - Date.now()` calculado en el momento de resolución.
 */
export interface IFactoryOptions<T> {
    nombre: string;
    cache: TCache<T>;
    key: string;
    fn: TFactoryExec<T>;
    defaultTimeout?: number;
}

/**
 * Función de caché genérica para peticiones asíncronas con expiración automática.
 *
 * Si la clave `key` ya existe en `cache`, devuelve la promesa en curso (o resuelta)
 * sin volver a ejecutar `fn`. Si no existe, ejecuta `fn`, almacena la promesa y
 * programa su eliminación de la caché cuando los datos expiren.
 *
 * El temporizador de expiración se reinicia en cada llamada para que peticiones
 * concurrentes que compartan la misma clave no eliminen la entrada prematuramente.
 *
 * ### Ciclo de vida de una entrada
 * 1. Primera llamada → se ejecuta `fn()` y se almacena la promesa en `cache[key]`.
 * 2. Llamadas simultáneas con la misma clave → reciben la misma promesa (sin re-ejecutar `fn`).
 * 3. Al resolverse `fn()`:
 *    - Si `expires` está en el futuro: se programa un `setTimeout` para eliminar la entrada.
 *    - Si `expires` ya pasó: se elimina la entrada inmediatamente.
 * 4. El tiempo de espera de carga se registra en el log solo en llamadas que causaron un cache miss.
 *
 * @template T - Tipo del dato devuelto por `fn`.
 * @param nombre - Nombre descriptivo del recurso; se usa en el log de tiempos.
 * @param cache - Objeto mapa donde se almacenan las entradas de caché.
 * @param key - Clave que identifica unívocamente esta entrada dentro de `cache`.
 * @param fn - Función asíncrona que obtiene el dato y su timestamp de expiración.
 * @param defaultTimeout - Duración (ms) del temporizador de expiración cuando no se
 *   puede calcular a partir del campo `expires` devuelto por `fn`. Si se omite y `expires`
 *   ya pasó en el momento de resolver, la entrada se elimina inmediatamente.
 * @returns Promesa que se resuelve con `{ data, expires }` tal como los devuelve `fn`.
 */
export async function factoryCache<T>({nombre, cache, key, fn, defaultTimeout}: IFactoryOptions<T>): Promise<IFactoryExpires<T>> {
    const time = Date.now();
    const cacheOK = cache[key]!==undefined;
    const salida = cache[key] ??= {
        data: fn(),
    };
    if (salida.timeout) {
        // si ya tenemos un temporizador lo paramos
        clearTimeout(salida.timeout);
        salida.timeout = undefined;
    }

    salida.data
        .then(({expires}) => {
            // Al completarse la carga, programar la expiración de la entrada.
            // Si hay varias peticiones concurrentes para la misma clave, cada handler
            // cancela el timer anterior antes de instalar el suyo para evitar timers huérfanos.
            if (salida.timeout) {
                clearTimeout(salida.timeout);
                salida.timeout = undefined;
            }
            if (expires > Date.now()) {
                salida.timeout = setTimeout(() => {
                    delete cache[key];
                    salida.timeout = undefined;
                }, defaultTimeout ?? expires - Date.now());
            } else {
                delete cache[key];
            }
            if (!cacheOK) {
                info("Tiempo de espera", nombre, key, Date.now() - time);
            }
        })
        .catch(() => undefined);

    return salida.data;
}

