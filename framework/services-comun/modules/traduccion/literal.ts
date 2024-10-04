import {type ITranslation, type TParams, Translation} from "./index";

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
