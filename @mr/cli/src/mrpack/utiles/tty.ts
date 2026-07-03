/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 30 Jun 2026 10:13:56 GMT
 * Hash: ffdc6adad686ff68387a5a8886b4c557
 * Versión: 2026.6.30+2-josantoniojimnez
 * Anterior: 2026.6.26+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-ads.git
 */

import readline from "node:readline";

import {Colors} from "./colors";

/**
 * Devuelve el ancho visible de una cadena en el terminal: elimina los códigos ANSI
 * y normaliza a NFC para que caracteres compuestos (como `í` en forma NFD) no inflen
 * el recuento y descuadren los bordes de los paneles TUI.
 *
 * @param str - Cadena posiblemente coloreada con códigos ANSI.
 * @returns Número de columnas que ocupa la cadena en el terminal.
 */
export function anchoVisible(str: string): number {
    return str.replace(/\x1b\[[0-9;]*m/g, "").normalize("NFC").length;
}

/**
 * Gestiona el redibujado de un bloque de líneas en el terminal sobrescribiendo
 * el contenido anterior para evitar duplicados al refrescar.
 *
 * Encapsula el conteo de filas físicas (teniendo en cuenta el ajuste automático del
 * terminal) y el borrado de las filas sobrantes cuando el nuevo contenido es más corto.
 */
export class Render {
    /* INSTANCE */
    private lineasDibujadas: number;

    public constructor() {
        this.lineasDibujadas = 0;
    }

    /**
     * Cuenta las filas físicas que ocupan las líneas teniendo en cuenta el ajuste
     * automático del terminal.
     *
     * @param lineas - Líneas (posiblemente con códigos ANSI) a medir.
     * @returns Número de filas físicas ocupadas.
     */
    private contarFisicas(lineas: string[]): number {
        const termW = process.stdout.columns ?? 80;
        return lineas.reduce((acc, linea) => {
            const visible = anchoVisible(linea);
            return acc + Math.max(1, Math.ceil(visible / termW));
        }, 0);
    }

    /**
     * Redibuja el bloque de líneas, borrando el contenido previo.
     *
     * @param lineas - Nuevas líneas a mostrar.
     */
    public dibujar(lineas: string[]): void {
        const prev = this.lineasDibujadas;
        if (prev > 0) {
            process.stdout.write(`\r${Colors.up(prev)}`);
        }
        for (const linea of lineas) {
            process.stdout.write(`\r\x1b[K${linea}\n`);
        }
        const nuevas = this.contarFisicas(lineas);
        const extra = prev - nuevas;
        if (extra > 0) {
            for (let i = 0; i < extra; i++) {
                process.stdout.write("\r\x1b[K\n");
            }
            process.stdout.write(Colors.up(extra));
        }
        this.lineasDibujadas = nuevas;
    }

    /**
     * Borra de la pantalla todas las líneas dibujadas, dejando el cursor en su posición original.
     */
    public limpiar(): void {
        if (this.lineasDibujadas <= 0) {
            return;
        }
        process.stdout.write(`\r${Colors.up(this.lineasDibujadas)}`);
        for (let i = 0; i < this.lineasDibujadas; i++) {
            process.stdout.write("\x1b[K\n");
        }
        process.stdout.write(Colors.up(this.lineasDibujadas));
        this.lineasDibujadas = 0;
    }
}

/**
 * Activa el modo raw del terminal, habilita keypress y oculta el cursor.
 * Debe llamarse antes de arrancar cualquier menú TUI interactivo.
 */
export function prepararTTY(): void {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdout.write("\x1b[?25l");
}

/**
 * Restaura el terminal: desactiva modo raw, pausa stdin y muestra el cursor.
 * Debe llamarse siempre al finalizar (confirmar o cancelar) un menú TUI interactivo.
 */
export function restaurarTTY(): void {
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    process.stdout.write("\x1b[?25h");
}

