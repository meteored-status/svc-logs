import {type ITranslation, type TParams, Translation} from "./index";

export class TraduccionPlural<T extends TParams={}> extends Translation<T> {
    /* INSTANCE */
    public constructor(cfg: ITranslation, protected readonly defecto: string, protected readonly valores: Record<string, string>) {
        super(cfg);
    }

    public render(i: number, params?: Partial<T>): string {
        return this.aplicarParams(this.valores[i]??this.defecto, params);
    }
}
