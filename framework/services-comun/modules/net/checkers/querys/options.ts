import {IQuery, Query} from "./query";

class Options extends Query {
    public constructor(key: string, obj: IQuery, private options: string[]) {
        super(key, obj);
    }

    protected checkEjecutar(param: string): boolean {
        return this.options.includes(param);
    }
}

export {Options};
