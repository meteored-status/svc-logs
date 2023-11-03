import {IQuery, Query} from "./query";

class Prefix extends Query {
    public constructor(key: string, obj: IQuery, private prefix: string) {
        super(key, obj);
    }

    protected checkEjecutar(param: string): boolean {
        return param.startsWith(this.prefix);
    }
}

export {Prefix};
