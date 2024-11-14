import {type ITranslation, type TParams, Translation} from "./index";

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
