/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 174c427532bf4f0c9ba25c448284cc8d
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

/**
 * Renderizado de la línea de progreso interactiva de un `Paquete` en la consola:
 * nombre, versión actual/nueva coloreadas y estado (`pull`/`push`/`update`).
 */

import {Colors} from "../colors";
import {maquetarVersion} from "../../utiles/version";

/**
 * Estado de progreso mostrado en la línea de consola de un `Paquete`.
 *
 * - `EMPTY`     — sin estado (línea reservada, aún no procesada).
 * - `PENDING`   — operación en curso.
 * - `OK`        — operación completada con éxito.
 * - `KO`        — operación fallida.
 * - `CONFLICTO` — operación completada generando conflictos (merge 3-way).
 */
export const enum ConsolaEstado {
    EMPTY,
    PENDING,
    OK,
    KO,
    CONFLICTO,
}

const STATUS = {
    [ConsolaEstado.EMPTY]:     `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([],                              "         ")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
    [ConsolaEstado.PENDING]:   `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([Colors.FgYellow],                "PENDING  ")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
    [ConsolaEstado.OK]:        `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([Colors.FgGreen],                 "OK       ")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
    [ConsolaEstado.KO]:        `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([Colors.FgRed],                   "ERROR    ")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
    [ConsolaEstado.CONFLICTO]: `${Colors.colorize([Colors.FgWhite, Colors.Bright], "[")}${Colors.colorize([Colors.FgMagenta, Colors.Bright], "CONFLICTO")}${Colors.colorize([Colors.FgWhite, Colors.Bright], "]")}`,
};

/**
 * Opciones de una línea de progreso renderizada por {@link PaqueteConsola.render}.
 *
 * @property estado  - Estado de la operación a mostrar.
 * @property actual   - Si `true`, muestra la versión actual del paquete.
 * @property nueva    - Versión nueva a mostrar (si aplica).
 * @property mensaje  - Mensaje descriptivo de la operación en curso.
 */
export interface IConsola {
    estado?: ConsolaEstado;
    actual?: boolean;
    nueva?: string;
    mensaje?: string;
}

/**
 * Encapsula el estado y el renderizado de la línea de progreso interactiva de un
 * paquete dentro de una lista con cursor dinámico (`Colors.up`/`Colors.down`).
 */
export class PaqueteConsola {
    /* INSTANCE */
    private readonly nombre: string;
    private readonly versionActual: string;
    private padding: string;
    private index: number;
    private length: number;
    private avanzada: boolean;

    public constructor(nombre: string, version: string) {
        this.nombre = nombre;
        this.versionActual = Colors.colorize([Colors.FgBlue], maquetarVersion(version));
        this.padding = "";
        this.index = 0;
        this.length = 1;
        this.avanzada = false;
    }

    /** Versión actual coloreada, tal y como se muestra en la consola. */
    public get actual(): string {
        return this.versionActual;
    }

    /**
     * Ajusta el padding del nombre al ancho máximo `len` entre todos los paquetes de la lista.
     *
     * @param len - Longitud máxima entre todos los nombres de paquete en la lista.
     */
    public ajustarPadding(len: number): void {
        this.padding = " ".repeat(len - this.nombre.length);
    }

    /**
     * Activa el modo de cursor dinámico y fija la posición de este paquete dentro
     * de la lista, para que {@link render} mueva el cursor a la línea correcta.
     *
     * @param index  - Posición (0-based) de este paquete dentro de la lista.
     * @param length - Número total de líneas reservadas en la lista.
     */
    public configurarPosicion(index: number, length: number): void {
        this.index = index;
        this.length = length;
        this.avanzada = true;
    }

    /**
     * Renderiza una línea de progreso en la consola para este paquete.
     *
     * @param config - Opciones de la línea: estado, si muestra la versión actual, nueva versión y mensaje.
     */
    public render({estado=ConsolaEstado.EMPTY, actual=false, nueva, mensaje}: IConsola): void {
        const salida: string[] = [];
        if (this.avanzada) {
            salida.push(Colors.up(this.length - this.index));
        }
        salida.push(Colors.colorize([Colors.FgMagenta], `${this.nombre}${this.padding}`));
        salida.push(Colors.colorize([Colors.FgWhite, Colors.Bright], "["));
        if (actual) {
            salida.push(this.versionActual);
        } else {
            salida.push(" ".repeat(13));
        }
        salida.push(Colors.colorize([Colors.FgWhite, Colors.Bright], "]"));
        salida.push(Colors.colorize([Colors.FgWhite, Colors.Bright], "=>"));
        salida.push(mensaje?.substring(0, 30).padEnd(30)??" ".repeat(30));
        salida.push(Colors.colorize([Colors.FgWhite, Colors.Bright], "["));
        if (nueva!==undefined) {
            salida.push(this.formatVersionNueva(nueva));
        } else {
            salida.push(" ".repeat(13));
        }
        salida.push(Colors.colorize([Colors.FgWhite, Colors.Bright], "]"));
        salida.push(STATUS[estado]);
        if (this.avanzada) {
            salida.push(Colors.down(this.length - this.index - 1));
        }

        console.log(...salida);
    }

    /**
     * Formatea una versión con colores ANSI para mostrarla como "versión nueva" en la consola.
     *
     * @param version - Versión en formato `YYYY.MM.DD+INDEX`.
     * @returns Cadena de 13 caracteres coloreada en verde.
     */
    public formatVersionNueva(version: string): string {
        return Colors.colorize([Colors.FgGreen], maquetarVersion(version));
    }
}
