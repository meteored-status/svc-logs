/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 4e0c7aa613ad9b37bdd2d9fba82aef87
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

interface IUseCase<R> {

    execute(): Promise<R>;
}

export abstract class UseCase<I = any, R = void> implements IUseCase<R> {
    /* INSTANCE */
    public constructor(protected readonly input: I) {
    }

    public abstract execute(): Promise<R>;
}
