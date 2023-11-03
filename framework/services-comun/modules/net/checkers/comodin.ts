import {Checker, IExpresion} from ".";

class Comodin extends Checker {
    public constructor(obj: IExpresion, protected defecto: boolean) {
        super(obj);
    }

    protected checkEjecutar(url: string): string[]|null {
        return this.defecto?[url]:null;
    }
}

export {Comodin};
