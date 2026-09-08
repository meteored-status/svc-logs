/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 904bcec39c216a2093579adab29999d4
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.5.27+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Colors as ColorsBase} from "./base";

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
