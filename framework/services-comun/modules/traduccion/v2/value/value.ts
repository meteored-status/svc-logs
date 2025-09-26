export type TParams = Record<string, string|number>;

export abstract class Value<T extends TParams={}> {
    /* STATIC */

    /* INSTANCE */
    protected readonly params: string[];
    private readonly paramsRegex: RegExp[];
    protected readonly paramsLength;

    protected constructor(params: string[]) {
        this.params = params;
        this.paramsRegex = this.params.map(param => new RegExp(`\\{\\{${param}\\}\\}`, 'g'));
        this.paramsLength = params.length;
    }

    protected applyParams(value: string, params?: Partial<T>): string {
        if (this.paramsLength > 0) {
            params ??= {};
            for (let i = 0; i < this.paramsLength; i++) {
                value = value.replace(this.paramsRegex[i], params[this.params[i]]!=undefined ? `${params[this.params[i]]}` : this.params[i].toUpperCase());
            }
        }
        return value;
    }

    public abstract value(params?: Partial<T>): string;
}
