/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: c5204b55df8b0d123014a3cd16d47e4d
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Réplica mínima de `services-comun/modules/utiles/promise` para el arnés de pruebas: los `exports` de
 * `services-comun` apuntan a `.ts`, que `node --test` no resuelve sin bundler (ver `instalar.ts`).
 */

export class Deferred<T = void> {
    public promise: Promise<T>;
    public resolve!: (value: T | PromiseLike<T>) => void;
    public reject!: (reason?: unknown) => void;

    public constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

export class PromiseTimeoutError extends Error {
    public constructor(public readonly ms: number) {
        super(`Timed out: The promise did not resolve within ${ms} milliseconds.`);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = "PromiseTimeoutError";
    }
}

export async function PromiseTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
    const vencido = new Deferred<never>();
    const temporizador = setTimeout(() => {
        vencido.reject(new PromiseTimeoutError(ms));
    }, ms);

    try {
        return await Promise.race([promesa, vencido.promise]);
    } finally {
        clearTimeout(temporizador);
    }
}

export async function PromiseDelayed(delay = 0): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, delay));
}
