export type TParams = Record<string, string|number>;

export interface ITranslation {
    id: string;
    params?: string[];
}

export class Translation<T extends TParams={}> {
    /* INSTANCE */
    protected readonly id: string;

    private readonly params: string[];
    private readonly paramsRegex: RegExp[];
    private readonly paramsLength;

    protected constructor({id, params=[]}: ITranslation) {
        this.id = id;
        this.params = params;
        this.paramsRegex = this.params.map(param => new RegExp(`\\{\\{${param}\\}\\}`, 'g'));
        this.paramsLength = this.params.length;
    }

    protected aplicarParams(salida: string, params?: Partial<T>): string {
        if (this.paramsLength > 0) {
            params ??= {};
            for (let i = 0; i < this.paramsLength; i++) {
                salida = salida.replace(this.paramsRegex[i], params[this.params[i]]!=undefined ? `${params[this.params[i]]}` : this.params[i].toUpperCase());
            }
        }
        return salida;
    }
}
