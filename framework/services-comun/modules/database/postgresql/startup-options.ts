/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 06 Oct 2026 13:34:18 GMT
 * Hash: a38aa5f5d580a8df079b2ddd5b7aa3d6
 * Versión: 2026.10.6+1-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-localizacion.git
 */

// Nombre admitido para un parametro de `settings`: el de PostgreSQL, con el prefijo de su extension si lo tiene.
const NOMBRE_PARAMETRO: RegExp = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/i;

/**
 * Convierte `settings` en el valor de la opcion de arranque `options` de libpq: `-c nombre=valor` por parametro, con los espacios y
 * las barras del valor escapados con `\` como pide el protocolo.
 *
 * @throws Si algun nombre no es el de un parametro: se interpola en la cadena de arranque.
 */
export function startupOptions(settings: Record<string, string|number>): string {
    return Object.entries(settings).map(([nombre, valor]) => {
        if (!NOMBRE_PARAMETRO.test(nombre)) {
            throw new Error(`Nombre de parametro de PostgreSQL no valido: ${nombre}`);
        }

        return `-c ${nombre}=${String(valor).replaceAll("\\", "\\\\").replaceAll(" ", "\\ ")}`;
    }).join(" ");
}
