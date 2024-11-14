interface IFormatoFecha {
    anno?: boolean;
    mes?: boolean;
    dia?: boolean;
}

interface IDiffTime {
    time: number;
    unit: TTimeUnit;
}

export enum TTimeUnit {
    DAY         = 'd',
    HOUR        = 'h',
    MINUTE      = 'm',
    SECOND      = 's',
    MILLISECOND = 'ms'
}

export class Fecha {

    private static MESES: string[] = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto","Septiembre","Octubre","Noviembre", "Diciembre"]
    private static SEMANA: string[] = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

    public static generarFechaMySQL(date: Date): string {
        return [
            date.getUTCFullYear(),
            `00${date.getUTCMonth()+1}`.slice(-2),
            `00${date.getUTCDate()}`.slice(-2)
        ].join("-");
    }

    public static generarFechaElastic(date: Date, options: IFormatoFecha={}): string {
        options = {
            anno: true,
            mes: true,
            dia: true,
            ...options,
        }
        const campos: string[] = [];
        if (options.anno) {
            campos.push(`${date.getUTCFullYear()}`);
        }
        if (options.mes) {
            campos.push(`00${date.getUTCMonth()+1}`.slice(-2));
        }
        if (options.dia) {
            campos.push(`00${date.getUTCDate()}`.slice(-2));
        }
        if (campos.length>0) {
            return campos.join(".");
        }
        return "";
    }

    public static generarFechaNatural(date: Date): string {
        return [
            `00${date.getUTCDate()}`.slice(-2),
            `00${date.getUTCMonth()+1}`.slice(-2),
            date.getUTCFullYear(),
        ].join("/");
    }

    public static generarFechaNaturalConDiaSemana(date: Date): string {
        return `${Fecha.SEMANA[(date.getUTCDay()-1)>=0? date.getUTCDay()-1: Fecha.SEMANA.length-1]}, ` + [
            `00${date.getUTCDate()}`.slice(-2),
            `00${date.getUTCMonth()+1}`.slice(-2),
            date.getUTCFullYear(),
        ].join("/");
    }

    public static generarFechaBloque(date: Date): string {
        return [
            date.getUTCFullYear(),
            `00${date.getUTCMonth()+1}`.slice(-2),
            `00${date.getUTCDate()}`.slice(-2),
        ].join("");
    }

    public static generarFechaNumerica(date: Date): number {
        return date.getUTCFullYear()*10000 + (date.getUTCMonth()+1)*100 + date.getUTCDate();
    }

    public static generarHora(date: Date, tz: boolean = true): string {
        return [
            `00${date.getUTCHours()}`.slice(-2),
            `00${date.getUTCMinutes()}`.slice(-2),
            `00${date.getUTCSeconds()}`.slice(-2)
        ].join(":")+(tz?" UTC":"");

        // const offset = date.getTimezoneOffset();
        // if (offset!=0) {
        //     const abs = Math.abs(offset);
        //     salida += [
        //         offset>0?"+": "-",
        //         `00${Math.floor(abs/60)}`.slice(-2),
        //         `00${abs%60}`.slice(-2),
        //     ].join("");
        // }
        //
        // return salida;
    }

    public static generarHoraMinuto(date: Date, tz: boolean = true): string {
        return [
            `00${date.getUTCHours()}`.slice(-2),
            `00${date.getUTCMinutes()}`.slice(-2),
        ].join(":")+(tz?" UTC":"");

    }

    public static generarMarcaMinuto(date: Date): string {
        return [
            date.getUTCFullYear(),
            `00${date.getUTCMonth()+1}`.slice(-2),
            `00${date.getUTCDate()}`.slice(-2),
            `00${date.getUTCHours()}`.slice(-2),
            `00${date.getUTCMinutes()}`.slice(-2)
        ].join("");
    }

    public static generarMarcaMes(date: Date = new Date()): string {
        return [
            date.getUTCFullYear(),
            `00${date.getUTCMonth()+1}`.slice(-2)
        ].join("");
    }

    public static generarVersion(date: Date): string {
        return `${date.getUTCFullYear()}.${date.getUTCMonth()+1}.${date.getUTCDate()}-${date.getUTCHours()}${`00${date.getUTCMinutes()}`.slice(-2)}${`00${date.getUTCSeconds()}`.slice(-2)}`;
    }

    public static generarFechaHoraMySQL(date: Date): string {
        return `${Fecha.generarFechaMySQL(date)} ${Fecha.generarHora(date, false)}`;
    }

    public static generarFechaHoraNatural(date: Date, tz: boolean = true): string {
        return `${Fecha.generarFechaNatural(date)} ${Fecha.generarHoraMinuto(date, tz)}`;
    }

    public static generarFechaHoraNaturalConDiaSemana(date: Date, tz: boolean = true): string {
        return `${Fecha.generarFechaNaturalConDiaSemana(date)} ${Fecha.generarHoraMinuto(date, tz)}`;
    }

    public static generarIntervaloFechasNatural(inicio: Date, fin: Date) {
        return inicio.getDate() == fin.getDate() && inicio.getMonth() == fin.getMonth() && inicio.getFullYear() == fin.getFullYear() ?
            `${inicio.getDate()} ${this.MESES[inicio.getMonth()]}` :
            `${inicio.getDate()}${inicio.getMonth() != fin.getMonth() ? ` ${this.MESES[inicio.getMonth()]}` : ""} - ${fin.getDate()} ${this.MESES[fin.getMonth()]}`
    }

    /**
     * Genera un objeto Date a partir de una fecha MySQL.
     * La fecha MySQL debe estar en formato YYYY-MM-DD HH:mm:SS o YYYY-MM-DD.
     * @param mysql Cadena con la fecha MySQL.
     */
    public static generarDateDesdeMySQL(mysql: string): Date {
        const dateParts: number[] = mysql.split(/[- :]/).map((part: string) => {return parseInt(part);});
        return new Date(Date.UTC(dateParts[0], dateParts[1]-1, dateParts[2], dateParts[3] || 0, dateParts[4] || 0, dateParts[5] || 0));
    }

    /**
     * Devuelve una fecha MySQL como UTC.
     * Ignora la zona horaria de la fecha de entrada y asigna la zona UTC a ese mismo instante.
     * @param mysql Fecha mysql
     */
    public static ignoraTZ(mysql: Date): Date {
        return new Date(Date.UTC(mysql.getFullYear(), mysql.getMonth(), mysql.getDate(), mysql.getHours(), mysql.getMinutes(), mysql.getSeconds(), mysql.getMilliseconds()));
    }

    public static generarLog(): string {
        return `[${this.generarFechaHoraNatural(new Date(), false)}]`;
    }

    /**
     * Devuelve la diferencia entre dos fechas en unidades de tiempo.
     * Indica la unidad de tiempo y la cantidad de unidades de dicha unidad.
     * @param ms Milisegundos de diferencia.
     */
    public static determineDiffTime(ms: number): IDiffTime {
        const result: IDiffTime = {
            time: ms,
            unit: TTimeUnit.MILLISECOND
        }

        if (ms > 86400000) {
            result.time = parseFloat((ms / 86400000).toFixed(2));
            result.unit = TTimeUnit.DAY;
        } else if (ms > 3600000) {
            result.time = parseFloat((ms / 3600000).toFixed(2));
            result.unit = TTimeUnit.HOUR;
        } else if (ms > 60000) {
            result.time = parseFloat((ms / 60000).toFixed(2));
            result.unit = TTimeUnit.MINUTE;
        } else if (ms > 1000) {
            result.time = parseFloat((ms / 1000).toFixed(2));
            result.unit = TTimeUnit.SECOND;
        }

        return result;
    }

    public static getDate(timeZone: string): Date {
        // Convertir a una zona horaria específica
        return new Date(new Date().toLocaleString('en-US', { timeZone }));
    }
}
