import {Fecha} from "../../../modules/utiles/fecha";
import {Colors} from "./colors";

interface ILogConfig {
    type: string;
    label: string;
}

export class Log {
    /* STATIC */
    public static readonly label_base: string =     `${Colors.colorize([Colors.FgYellow, Colors.Underscore], "ENTORNO")} `;
    public static readonly label_compilar: string = `${Colors.colorize([Colors.FgGreen, Colors.Underscore],  "GENERAR")} `;
    public static readonly label_ejecutar: string = `${Colors.colorize([Colors.FgCyan, Colors.Underscore],   "EJECUTAR")}`;

    private static generarFechaLog(cfg: ILogConfig): string {
        return `[${Fecha.generarHora(new Date(), false)}][${cfg.type}][${cfg.label}]`;
    }

    public static info(cfg: ILogConfig, ...txt: any): void {
        if (txt.length>0) {
            console.info(this.generarFechaLog(cfg), ...txt);
        }
    }

    public static error(cfg: ILogConfig, ...txt: any): void {
        if (txt.length>0) {
            console.error(this.generarFechaLog(cfg), ...txt);
        }
    }

    /* INSTANCE */
}
