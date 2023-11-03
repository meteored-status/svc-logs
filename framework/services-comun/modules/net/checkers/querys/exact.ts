import {IQuery, Query} from "./query";

class Exact extends Query {
    public constructor(key: string, obj: IQuery, private param: string) {
        super(key, obj);
    }

    protected checkEjecutar(param: string): boolean {
        return this.param==param;
    }
}

export {Exact};
