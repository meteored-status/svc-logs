/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: f64f2a409afac9df87fc02daefaebf50
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export type TParams = Record<string, string|number>;

export abstract class Value<T extends TParams={}> {
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
