import {Checker, IExpresion} from ".";

class Prefix extends Checker {
    private readonly length: number;

    public constructor(obj: IExpresion, private prefix: string) {
        super(obj);

        this.length = prefix.length;
    }

    protected checkEjecutar(url: string): string[]|null {
        return url.startsWith(this.prefix)?[url.substring(this.length)]:null;
    }
}

export {Prefix};
