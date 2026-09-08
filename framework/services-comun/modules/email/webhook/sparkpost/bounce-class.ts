/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 03 Sep 2026 13:36:43 GMT
 * Hash: 9fb6a548d08c11b7a636d0dab4c134c0
 * Versión: 2026.9.3+3-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-newsletter.git
 */

/**
 * Categoría de un rebote, derivada de la clase que asigna Sparkpost.
 *
 * - `hard`         — el destinatario no existe. No se debe reintentar.
 * - `soft`         — fallo temporal (buzón lleno, timeout, DNS). Puede reintentarse.
 * - `block`        — el receptor rechazó el envío (filtro antispam, relay denegado).
 * - `admin`        — el envío no llegó a intentarse: lo detuvo el propio proveedor.
 * - `auto_reply`   — respuesta automática de ausencia. **No es un fallo de entrega.**
 * - `undetermined` — Sparkpost no supo clasificar la respuesta del receptor.
 */
export type TBounceCategory = "hard" | "soft" | "block" | "admin" | "auto_reply" | "undetermined";

/**
 * Clase de las direcciones que Sparkpost se niega a enviar porque están en su lista de supresión
 * (*Admin Failure*), con el motivo literal `recipient address was suppressed due to customer
 * policy`. **No es un rebote nuevo**: es la consecuencia de uno anterior, y el mensaje ni se
 * intentó. Domina el tráfico —un 93 % de los eventos `bounce`— así que confundirla con un rebote
 * real hace que la métrica mida sobre todo el tamaño de la lista de supresión.
 */
export const BOUNCE_CLASS_SUPPRESSED = 25;

/**
 * Clase de las autorespuestas de ausencia. Llega como `out_of_band`, pero el mensaje **sí** se
 * entregó: tratarla como fallo restaría entregas buenas.
 */
export const BOUNCE_CLASS_AUTO_REPLY = 60;

/**
 * Taxonomía oficial de Sparkpost. Se respeta tal cual, aunque algún caso concreto sea discutible
 * —la clase 21 (*DNS Failure*) llega con motivos tan definitivos como `Domain Does Not Exist` y aun
 * así es `soft`—, para que la categoría signifique lo mismo aquí que en el panel del proveedor.
 */
const CATEGORIAS: Record<number, TBounceCategory> = {
    1: "undetermined",
    10: "hard",
    20: "soft",
    21: "soft",
    22: "soft",
    23: "soft",
    24: "soft",
    25: "admin",
    30: "hard",
    40: "soft",
    50: "block",
    51: "block",
    52: "block",
    53: "block",
    54: "block",
    60: "auto_reply",
    70: "soft",
    80: "admin",
    90: "admin",
    100: "admin",
};

/**
 * Normaliza la clase de rebote de un evento de Sparkpost. **El proveedor la manda como cadena**
 * (`"25"`, no `25`), así que compararla sin convertir no casa nunca.
 *
 * @param clase - Valor crudo de `bounce_class`, tal cual viene en el payload.
 * @returns La clase como número, o `undefined` si el evento no traía ninguna o no es numérica.
 */
export function claseRebote(clase: string|number|undefined): number|undefined {
    if (clase == null) {
        return undefined;
    }
    const valor = Number(clase);
    return Number.isFinite(valor) ? valor : undefined;
}

/**
 * Traduce una clase de rebote a su categoría.
 *
 * @param clase - Clase ya normalizada por {@link claseRebote}.
 * @returns La categoría correspondiente, o `undefined` si no hay clase. Una clase desconocida
 *          —Sparkpost podría añadir alguna— cae en `undetermined` en vez de perderse.
 */
export function categoriaRebote(clase: number|undefined): TBounceCategory|undefined {
    if (clase == null) {
        return undefined;
    }
    return CATEGORIAS[clase] ?? "undetermined";
}
