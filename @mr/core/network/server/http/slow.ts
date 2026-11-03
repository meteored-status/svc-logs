/**
 * Editor: Bixus
 * Fecha: Thu, 22 Oct 2026 07:08:16 GMT
 * Hash: 27f94e7afedb54cb5face5d2fc1b2bec
 * Versión: 2026.10.22+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Decisiones puras del aviso de petición lenta del servidor HTTP.
 *
 * Viven aparte de `server.ts` para poder probarlas sin levantar un servidor. El umbral por defecto es
 * {@link Net.slow} (`config/net.ts`); una ruta puede sustituirlo con `IRouteGroup.slow`, que el router deja
 * en `Conexion.slow` cuando la ruta hace match.
 *
 * Un umbral `<= 0` (o `NaN`) significa «sin aviso».
 */

/**
 * Umbral efectivo de una petición: el de la ruta si lo fijó, el de la configuración si no.
 *
 * @param umbralConfig - Umbral por defecto del servidor, en ms.
 * @param umbralRuta   - Umbral fijado por la ruta que hizo match, en ms. `0` desactiva el aviso. `undefined` = sin override.
 */
export function umbralLento(umbralConfig: number, umbralRuta?: number): number {
    return umbralRuta ?? umbralConfig;
}

/**
 * Cuánto falta para avisar de una petición en curso.
 *
 * @param umbral      - Umbral efectivo en ms (ver {@link umbralLento}).
 * @param transcurrido - Ms desde que llegó la petición.
 * @returns `null` si no hay que avisar nunca (umbral desactivado), `0` si ya toca avisar, o los ms que faltan
 *   para llegar al umbral (el temporizador tiene que reprogramarse por ese tiempo).
 */
export function esperaLenta(umbral: number, transcurrido: number): number|null {
    if (!(umbral > 0)) {
        return null;
    }

    return Math.max(0, umbral - transcurrido);
}

/**
 * Indica si una petición ya terminada tardó más que su umbral.
 *
 * @param umbral       - Umbral efectivo en ms (ver {@link umbralLento}).
 * @param transcurrido - Ms que tardó la petición.
 */
export function esLenta(umbral: number, transcurrido: number): boolean {
    return umbral > 0 && transcurrido > umbral;
}

/**
 * Texto corto de un umbral para el mensaje del aviso: segundos enteros (`1sg`, `15sg`) o milisegundos (`1500ms`).
 *
 * @param umbral - Umbral en ms.
 */
export function textoUmbral(umbral: number): string {
    return umbral % 1000 === 0 ? `${umbral / 1000}sg` : `${umbral}ms`;
}
