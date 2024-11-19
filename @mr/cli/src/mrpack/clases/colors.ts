import {Colors as ColorsBase} from "../utiles/colors";

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

    public static nextColor(): string[] {
        const color = this.COLORS[this.I];
        this.I = (this.I + 1) % this.COLORS.length;
        return color;
    }

    public static resetNext(): void {
        this.I = 0;
    }

    /* INSTANCE */
}
