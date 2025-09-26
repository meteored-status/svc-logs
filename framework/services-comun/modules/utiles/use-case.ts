interface IUseCase<R> {

    execute(): Promise<R>;
}

export abstract class UseCase<I = any, R = void> implements IUseCase<R> {
    /* STATIC */

    /* INSTANCE */
    public constructor(protected readonly input: I) {
    }

    public abstract execute(): Promise<R>;
}
