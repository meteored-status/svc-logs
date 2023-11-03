import {IQuery, Query} from "./query";

class Regex extends Query {
    public constructor(key: string, obj: IQuery, private regex: RegExp) {
        super(key, obj);
    }

    protected checkEjecutar(param: string): boolean {
        return Array.isArray(param.match(this.regex));
    }
}

export {Regex};
