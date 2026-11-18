/**
 * Editor: miguel
 * Fecha: Mon, 16 Nov 2026 15:13:05 GMT
 * Hash: 9932d1870a790d4dccb3aababd4ed368
 * Versión: 2026.11.16+1-miguel
 * Proyecto: https://github.com/alpred/meteored-web-www.git
 */

/**
 * Valor de una cookie dentro de una cabecera `Cookie` (`document.cookie` o `request.headers.cookie`), o `undefined` si no
 * está. El valor se decodifica con `decodeURIComponent`; si está mal codificado no lanza: devuelve el valor tal cual
 * llegó, porque en el servidor la cabecera la controla quien hace la petición.
 *
 * @param cabecera - Cabecera `Cookie` completa (`a=1; b=2`). `undefined` equivale a vacía.
 * @param key      - Nombre exacto de la cookie.
 */
export function leerCookie(cabecera: string | undefined, key: string): string | undefined {
    for (const par of (cabecera ?? "").split(";")) {
        const igual = par.indexOf("=");
        if (igual > 0 && par.slice(0, igual).trim() === key) {
            const valor = par.slice(igual + 1).trim();
            try {
                return decodeURIComponent(valor);
            } catch {
                return valor;
            }
        }
    }

    return undefined;
}
