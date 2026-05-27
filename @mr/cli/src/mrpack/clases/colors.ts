/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 05e2b09b5920022fc3a5dbbed6f2991a
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import {Colors as ColorsBase} from "../utiles/colors";

/**
 * Paleta de colores ANSI cíclica para asignar un color diferente a cada workspace en la consola.
 * Extiende `ColorsBase` con un ciclo de 21 combinaciones de color/intensidad.
 */
export class Colors extends ColorsBase {
    /* STATIC */
    private static COLORS = [
        [this.FgCyan, this.Bright],
        [this.FgGreen, this.Bright],
        [this.FgMagenta, this.Bright],
        [this.FgYellow, this.Bright],
        [this.FgRed, this.Bright],
        [this.FgWhite, this.Bright],
        [this.FgBlue, this.Bright],

        [this.FgCyan],
        [this.FgGreen],
        [this.FgMagenta],
        [this.FgYellow],
        [this.FgRed],
        [this.FgWhite],
        [this.FgBlue],

        [this.FgCyan, this.Dim],
        [this.FgGreen, this.Dim],
        [this.FgMagenta, this.Dim],
        [this.FgYellow, this.Dim],
        [this.FgRed, this.Dim],
        [this.FgWhite, this.Dim],
        [this.FgBlue, this.Dim],
    ];

    private static I = 0;

    /**
     * Devuelve el siguiente color ANSI disponible de la paleta cíclica.
     * Avanza el índice interno para que la siguiente llamada devuelva un color diferente.
     *
     * @returns Array de códigos de escape ANSI que definen el color (p.ej. `["\x1b[36m", "\x1b[1m"]`).
     */
    public static nextColor(): string[] {
        const color = this.COLORS[this.I];
        this.I = (this.I + 1) % this.COLORS.length;
        return color;
    }

    /**
     * Reinicia el índice del ciclo de colores al principio de la paleta.
     */
    public static resetNext(): void {
        this.I = 0;
    }

    /* INSTANCE */
}
