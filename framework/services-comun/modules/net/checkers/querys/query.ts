export interface IQuery {
    // nota, si no se selecciona ninguno de estos entonces el parámetro se ignora
    regex?: RegExp;
    exact?: string;
    prefix?: string;
    options?: string[];
    cualquiera?: number;
    // fin de nota

    opcional?: boolean;
}

export abstract class Query {
    public opcional: boolean;

    protected constructor(public key: string, obj: IQuery) {
        this.opcional = obj.opcional??false;
    }

    public check(parametro: string[]): boolean {
        switch(parametro.length) {
            case 0:
                return false;
            case 1:
                return this.checkEjecutar(parametro[0]);
            default:
                return parametro.reduce<boolean>((inicial, actual)=>{
                    return inicial && this.checkEjecutar(actual);
                }, true);
        }
    }

    protected abstract checkEjecutar(param: string): boolean;
}
