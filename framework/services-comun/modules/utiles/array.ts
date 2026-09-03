/**
 * Editor: Bixus
 * Fecha: Thu, 03 Sep 2026 09:20:09 GMT
 * Hash: eb4ab84376d697320d3ddbee2f8cd7c2
 * Versión: 2026.9.3+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

type TEscalares = string|number|boolean|null;

export function arrayEquals<T extends TEscalares>(array1: T[], array2: T[]): boolean {
    return array1.filter((valor)=>array2.includes(valor)).length == array1.length;
}

export function unique<T extends TEscalares>(array: T[]): T[] {
    return array.filter((item, i, ar)=>ar.indexOf(item)===i);
}

/**
 * Trocea un array en bloques de como mucho `length` elementos.
 *
 * Un array vacío no produce ningún bloque (`[]`, no `[[]]`): un bloque vacío no representa nada
 * que procesar y obligaba a quien lo consumía a comprobar el tamaño antes de llamar.
 *
 * @param array  - Elementos a trocear.
 * @param length - Tamaño máximo de cada bloque. `0` o negativo equivale a no trocear.
 * @returns Un bloque por cada tramo, en orden; `[]` si `array` está vacío.
 */
export function arrayChop<T>(array: T[], length: number=array.length): T[][] {
    if (array.length===0) {
        return [];
    }

    if (length<=0) {
        length = array.length;
    }

    if (length>=array.length) {
        return [array];
    }

    const salida: T[][] = [];
    const total = array.length;
    let inicio = 0;
    while (inicio<total) {
        const fin = inicio+length;
        salida.push(array.slice(inicio, fin));
        inicio = fin;
    }

    return salida;
}
