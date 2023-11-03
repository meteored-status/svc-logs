import {Checker, IExpresion} from ".";

class Exact extends Checker {
    public constructor(obj: IExpresion, private file: string) {
        super(obj);
    }

    protected checkEjecutar(url: string): string[]|null {
        return this.file==url?[]:null;
    }
}

export {Exact};
