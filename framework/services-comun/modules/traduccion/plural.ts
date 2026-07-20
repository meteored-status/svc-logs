/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 13:19:30 GMT
 * Hash: 1ff8af5944d2097f3edcbdc27af07c27
 * Versión: 2026.6.17+7-josantoniojimnez
 */

import {type ITranslation, type TParams, Translation} from ".";

export class TraduccionPlural<T extends TParams={}> extends Translation<T> {
    /* INSTANCE */
    public constructor(cfg: ITranslation, protected readonly defecto: string, protected readonly valores: Record<string, string>) {
        super(cfg);
    }

    public render(i: number, params: Partial<T>={}): string {
        if (this.params.includes("i")) {
            params = {
                i,
                ...params,
            };
        } else if (this.paramsLength>0) {
            params = {
                [this.params[0]]: i,
                ...params,
            };
        }

        return this.aplicarParams(this.valores[i]??this.defecto, params);
    }
}
