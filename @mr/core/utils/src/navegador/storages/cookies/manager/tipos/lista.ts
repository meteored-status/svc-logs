/**
 * Editor: miguel
 * Fecha: Thu, 12 Nov 2026 11:34:11 GMT
 * Hash: 06e0899f5bfee0ea4946f8f6361153c9
 * Versión: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

const DELIMITADOR_DEFECTO = ",";
/**
 * Pasa una lista a texto, con sus elementos separados por `delimitador`.
 *
 * `[1, 2, 3]` con `","` da `"1,2,3"`.
 *
 * @param lista - Elementos a serializar. No deben contener el delimitador.
 * @param delimitador - Separador entre elementos. Por defecto `","`.
 */
export function serializarLista<T>(lista: T[], delimitador = DELIMITADOR_DEFECTO): string {
    return lista.join(delimitador);
}

/**
 * Pasa un texto a lista: lo parte por `delimitador`, recorta los espacios de cada elemento,
 * descarta los vacíos y convierte cada uno con `parser`.
 *
 * Un texto vacío, `null` o `undefined` da una lista vacía.
 *
 * @param raw - Texto a deserializar.
 * @param parser - Conversión de cada elemento, p. ej. `Number` o `Serializadores.number.deserialize`.
 * @param delimitador - Separador entre elementos. Por defecto `","`.
 */
export function deserializarLista<T>(raw: string, parser: (item: string) => T, delimitador = DELIMITADOR_DEFECTO): T[] {
    if (!raw || raw.trim() === "") {
        return [];
    }
    return raw
        .split(delimitador)
        .map((item) => item.trim())
        .filter(Boolean)
        .map(parser);
}
