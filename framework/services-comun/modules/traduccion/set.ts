import {type ITranslation, type TParams, Translation} from "./index";

export type TValor = string | null;

export class TraduccionSet<T extends TParams={}> extends Translation<T> {
    /* INSTANCE */
    public constructor(cfg: ITranslation, protected readonly valores: TValor[], protected readonly defecto?: string) {
        super(cfg);
    }

    public render(i: number, params?: Partial<T>): string {
        return this.aplicarParams(this.valores[i]??this.defecto??`${this.id.toUpperCase()}[${i}]`, params);
    }
}
