import {IQuery, Query} from "./query";

class Cualquiera extends Query {
    public constructor(key: string, obj: IQuery, private longitud: number) {
        super(key, obj);
    }

    protected checkEjecutar(param: string): boolean {
        return param.length>=this.longitud;
    }
}

export {Cualquiera};
