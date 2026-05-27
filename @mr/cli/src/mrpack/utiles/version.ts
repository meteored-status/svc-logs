/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 644968258aa1cdbc1f3d27629ed36773
 * Versión: 2026.5.27+1-josantoniojimnez
 */

/**
 * Utilidades de comparación y formateo de versiones en formato `YYYY.MM.DD+INDEX[-autor]`.
 * Compartidas por los módulos `paquete` y `framework/gestor`.
 */

/** Extrae la fecha UTC del campo `YYYY.MM.DD` de una cadena de versión.
 *
 * @param version - Versión en formato `YYYY.MM.DD+INDEX[-autor]`.
 * @returns Objeto `Date` con la fecha UTC correspondiente.
 */
export function parsearFechaVersion(version: string): Date {
    const [base] = version.split("+");
    const partes = base.split(".");
    return new Date(Date.UTC(
        parseInt(partes[0], 10),
        parseInt(partes[1] ?? "1", 10) - 1,
        parseInt(partes[2] ?? "1", 10),
    ));
}

/**
 * Compara dos versiones en formato `YYYY.MM.DD+INDEX[-autor]`.
 *
 * @param a - Primera versión a comparar.
 * @param b - Segunda versión a comparar.
 * @returns Negativo si `a` < `b`, 0 si son iguales, positivo si `a` > `b`.
 */
export function compararVersiones(a: string, b: string): number {
    const parsear = (v: string): [number, number, number, number] => {
        const [base, sub = "0"] = v.split("+");
        const [x, y, z] = base.split(".").map(n => parseInt(n, 10));
        return [x, y, z, parseInt(sub, 10)];
    };
    const [aA, aB, aC, aSub] = parsear(a);
    const [bA, bB, bC, bSub] = parsear(b);
    return (aA - bA) || (aB - bB) || (aC - bC) || (aSub - bSub);
}

/**
 * Formatea una cadena de versión en 13 caracteres rellenos, alineados para la consola
 * de progreso.
 *
 * @param version - Versión en formato `YYYY.MM.DD+INDEX[-autor]`.
 * @returns Cadena de 13 caracteres.
 */
export function maquetarVersion(version: string): string {
    const [actual, build] = version.split("-")[0].split("+").slice(0, 2);
    const partes = actual.split(".");
    return `${partes[0].padStart(4, " ")}.${partes[1].padStart(2, " ")}.${partes[2].padStart(2, " ")}+${build}`.padEnd(13);
}

/**
 * Incrementa la parte de índice/fecha de una versión y añade el sufijo de autor.
 *
 * @param version - Versión base desde la que incrementar.
 * @param autor   - Nombre del autor que se añade como sufijo.
 * @returns Nueva versión en formato `YYYY.MM.DD+INDEX-autor`.
 */
export function incrementarVersion(version: string, autor: string): string {
    const partes = /^(\d{4}\.\d{1,2}\.\d{1,2})\+(\d+)(?:[+-](.*))?$/.exec(version);
    let fecha: string;
    let index: number;
    if (partes == null) {
        fecha = "2022.1.1";
        index = 1;
    } else {
        fecha = partes[1];
        index = parseInt(partes[2]);
    }

    const date = new Date();
    const fechaActual = [
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
    ].join(".");

    if (fecha === fechaActual) {
        index++;
    } else {
        index = 1;
    }

    return `${fechaActual}+${index}-${autor.toLowerCase().replace(/\W/g, "")}`;
}

