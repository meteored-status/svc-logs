import {Checker, IExpresion} from ".";

class Regex extends Checker {
    private readonly prefix: string;

    public constructor(obj: IExpresion, private regex: RegExp, prefix?: string) {
        super(obj);

        this.prefix = prefix??"/";
    }

    protected checkEjecutar(url: string): string[]|null {
        if (!url.startsWith(this.prefix)) {
            return null;
        }
        const salida = url.match(this.regex);
        if (salida!=null) {
            return salida.slice(1);
        }

        return null;
    }
}

export {Regex};
