/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 13:19:30 GMT
 * Hash: aa785c0eb47286090b6a0f1e1cb58ff6
 * Versión: 2026.6.17+7-josantoniojimnez
 */

import {type ITranslation, type TParams, Translation} from ".";

export class TraduccionLiteral<T extends TParams={}> extends Translation<T> {
    /* INSTANCE */
    public constructor(cfg: ITranslation, protected readonly valor: string) {
        super(cfg);
    }

    public override toString(): string {
        return this.valor;
    }

    public render(params?: Partial<T>): string {
        return this.aplicarParams(this.valor, params);
    }
}
