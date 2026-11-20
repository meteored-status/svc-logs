/**
 * Editor: Bixus
 * Fecha: Wed, 18 Nov 2026 15:20:23 GMT
 * Hash: 098b8f1140c34a71ee7b601ebcce4d7b
 * Versión: 2026.11.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Reparto en el tiempo de lo que el servidor WebSocket hace a todos sus clientes a la vez: el `Shutdown` del
 * apagado y el reciclado por edad de cada conexión. **Funciones puras y sin imports**, para poder probarlas sin
 * levantar nada: el azar entra siempre por parámetro.
 *
 * ### Por qué existe
 * Cuando una réplica de un servidor con cientos de clientes WebSocket se apaga, todos reconectan a la vez contra
 * las réplicas que quedan. Visto en producción (status-external, 2026-11-18): un superviviente que se ha visto aguantar
 * unos 50 upgrades por segundo se atascó 3–4 s con 160–284/s. Los clientes de fuera del monorepo no se pueden tocar, así
 * que se reparte lo único que controla el servidor: cuándo les dice que se vayan.
 *
 * Cada cliente sigue recibiendo sus `Alive` hasta que le toca su `Shutdown` (el servidor borra su intervalo de liveness
 * justo antes de mandárselo), así que la ventana no afecta al `heartbeatTimeoutMs` de nadie.
 */

/** Tiempo (ms) que se da al cliente para cerrar por sí mismo tras recibir el `Shutdown`, antes de cerrarle el servidor. */
export const ESPERA_CIERRE_MS = 5000;

/** Tiempo máximo de vida (ms) de una conexión antes del reciclado, sin jitter. Con jitter, ver {@link vidaConexionMs}. */
export const MAX_LIVENESS_MS = 540_000;

/** Cuánto se acorta (ms, como máximo) la vida de una conexión para repartir los reciclados: de 420 a 540 s. */
export const LIVENESS_JITTER_MS = 120_000;

/** Por debajo de este número de clientes el `Shutdown` se manda a todos a la vez, como siempre. */
export const UMBRAL_ESCALONADO = 50;

/** Ritmo objetivo (clientes por segundo) al repartir el `Shutdown`. Con las réplicas que quedan, es lo que recibe cada una. */
export const RITMO_APAGADO_POR_S = 40;

/** Duración máxima (ms) de la ventana de reparto del `Shutdown`. */
export const VENTANA_MAX_MS = 10_000;

/** Margen (ms) que se deja entre el último cierre forzoso y el `timeoutMs` del apagado. */
export const MARGEN_APAGADO_MS = 1000;

/**
 * Datos de {@link ventanaApagadoMs}.
 *
 * @property clientes - Clientes con el socket abierto.
 * @property timeoutMs - `timeoutMs` del apagado: la ventana y el cierre forzoso del último cliente tienen que caber.
 * @property cloudRun - `true` si el proceso corre en Cloud Run (`K_SERVICE` definida). Por defecto `false`.
 */
interface IVentanaApagado {
    clientes: number;
    timeoutMs: number;
    cloudRun?: boolean;
}

/**
 * Datos de {@link retrasosApagado}.
 *
 * @property clientes - Número de clientes a repartir.
 * @property ventanaMs - Duración (ms) de la ventana de reparto (la de {@link ventanaApagadoMs}).
 * @property aleatorio - Fuente de azar en [0, 1): `Math.random` en producción.
 */
interface IRetrasosApagado {
    clientes: number;
    ventanaMs: number;
    aleatorio: () => number;
}

/**
 * Duración (ms) de la ventana en la que se reparte el `Shutdown` del apagado.
 *
 * - 0 en Cloud Run (`cloudRun`): su gracia es de 10 s, no cabe una ventana de hasta 10 s y no se sabe cuántos servidores WS
 *   hay en lambdas, así que ahí el apagado se comporta como siempre (todos a la vez).
 * - 0 por debajo de {@link UMBRAL_ESCALONADO} clientes: todos a la vez.
 * - Si no, el menor de: {@link VENTANA_MAX_MS}, lo que pide el ritmo ({@link RITMO_APAGADO_POR_S}) y lo que cabe
 *   en `timeoutMs` una vez descontados {@link ESPERA_CIERRE_MS} y {@link MARGEN_APAGADO_MS}. Así el último cliente
 *   se cierra siempre antes de que el apagado fuerce el cierre; con un `timeoutMs` corto (desarrollo, pruebas)
 *   la ventana es 0.
 *
 * @param datos - Ver {@link IVentanaApagado}.
 * @returns La ventana en ms, entera y nunca negativa.
 */
export function ventanaApagadoMs({clientes, timeoutMs, cloudRun = false}: IVentanaApagado): number {
    if (cloudRun || clientes < UMBRAL_ESCALONADO) {
        return 0;
    }

    const porRitmo = clientes / RITMO_APAGADO_POR_S * 1000;
    const porTimeout = timeoutMs - ESPERA_CIERRE_MS - MARGEN_APAGADO_MS;

    return Math.max(0, Math.floor(Math.min(VENTANA_MAX_MS, porRitmo, porTimeout)));
}

/**
 * Retraso (ms) con el que mandar el `Shutdown` a cada cliente. Los clientes se reparten **equiespaciados**
 * (el *i*-ésimo en *i* · ventana / n) y se **barajan** (Fisher-Yates con `aleatorio`): el ritmo es el objetivo y
 * no salen grumos, que sí saldrían con retrasos aleatorios independientes, y ningún cliente tiene un lugar fijo
 * en la cola (el orden de conexión se correlaciona con el reparto entre réplicas).
 *
 * @param datos - Ver {@link IRetrasosApagado}.
 * @returns `clientes` retrasos, en el orden en que se iteran los clientes. Todos en [0, ventanaMs).
 */
export function retrasosApagado({clientes, ventanaMs, aleatorio}: IRetrasosApagado): number[] {
    const retrasos: number[] = [];
    for (let i = 0; i < clientes; i++) {
        retrasos.push(Math.floor(i * ventanaMs / clientes));
    }
    for (let i = retrasos.length - 1; i > 0; i--) {
        const j = Math.floor(aleatorio() * (i + 1));
        const tmp = retrasos[i];
        retrasos[i] = retrasos[j];
        retrasos[j] = tmp;
    }

    return retrasos;
}

/**
 * Vida (ms) de una conexión concreta antes de reciclarla: {@link MAX_LIVENESS_MS} menos un jitter de hasta
 * {@link LIVENESS_JITTER_MS}. **Solo hacia abajo**: no se sabe por qué se eligieron 540 s (puede ser quedar por
 * debajo de algún límite de 600 s de un proxy), así que no se supera. Una cohorte abierta en la misma ráfaga se
 * recicla repartida en 2 minutos y no de golpe.
 *
 * Ojo: el servidor mira la edad solo en su intervalo de `Alive` (10 s), así que la vida **real** es esta vida redondeada
 * hacia arriba a un múltiplo de 10 s: 12 escalones, de 430 a 540 s.
 *
 * @param aleatorio - Fuente de azar en [0, 1): `Math.random` en producción.
 * @returns La vida en ms, en (420 000, 540 000].
 */
export function vidaConexionMs(aleatorio: () => number): number {
    return MAX_LIVENESS_MS - Math.floor(aleatorio() * LIVENESS_JITTER_MS);
}
