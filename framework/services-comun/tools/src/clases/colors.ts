export class Colors {
    /* STATIC */
    public static Reset = "\x1b[0m";
    public static Bright = "\x1b[1m"; // negrita
    public static Dim = "\x1b[2m"; // color apagado
    public static Underscore = "\x1b[4m";
    public static Blink = "\x1b[5m";
    public static Reverse = "\x1b[7m";
    public static Hidden = "\x1b[8m";

    public static FgBlack = "\x1b[30m";
    public static FgRed = "\x1b[31m";
    public static FgGreen = "\x1b[32m";
    public static FgYellow = "\x1b[33m";
    public static FgBlue = "\x1b[34m";
    public static FgMagenta = "\x1b[35m";
    public static FgCyan = "\x1b[36m";
    public static FgWhite = "\x1b[37m";

    public static BgBlack = "\x1b[40m";
    public static BgRed = "\x1b[41m";
    public static BgGreen = "\x1b[42m";
    public static BgYellow = "\x1b[43m";
    public static BgBlue = "\x1b[44m";
    public static BgMagenta = "\x1b[45m";
    public static BgCyan = "\x1b[46m";
    public static BgWhite = "\x1b[47m";

    private static COLORS = [
        [Colors.FgCyan, Colors.Bright],
        [Colors.FgGreen, Colors.Bright],
        [Colors.FgMagenta, Colors.Bright],
        [Colors.FgYellow, Colors.Bright],
        [Colors.FgRed, Colors.Bright],
        [Colors.FgWhite, Colors.Bright],
        [Colors.FgBlue, Colors.Bright],

        [Colors.FgCyan],
        [Colors.FgGreen],
        [Colors.FgMagenta],
        [Colors.FgYellow],
        [Colors.FgRed],
        [Colors.FgWhite],
        [Colors.FgBlue],

        [Colors.FgCyan, Colors.Dim],
        [Colors.FgGreen, Colors.Dim],
        [Colors.FgMagenta, Colors.Dim],
        [Colors.FgYellow, Colors.Dim],
        [Colors.FgRed, Colors.Dim],
        [Colors.FgWhite, Colors.Dim],
        [Colors.FgBlue, Colors.Dim],
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

    public static colorize(config: string[], text: string): string {
        return `${config.join("")}${text}${this.Reset}`;
    }

    /* INSTANCE */
}
