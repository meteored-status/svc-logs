/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 23 Jul 2026 10:11:20 GMT
 * Hash: 630273dd7c6490a520c439fc97028753
 * Versión: 2026.7.23+1-josantoniojimnez
 * Anterior: 2026.7.20+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-web-www.git
 */

export async function PromiseDelayed(delay: number = 0): Promise<void> {
    return new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve();
        }, delay);
    });
}

type PromiseFunction<T> = (item: T)=>Promise<T>;
export async function PromiseChain<T>(listado: T[], createPromise: PromiseFunction<T>): Promise<T[]> {
    const salida:T[] = [];
    for (let actual of listado) {
        const resultado = await createPromise(actual);
        salida.push(resultado);
    }
    return salida;
}

type PromiseFunctionWTB<T> = ()=>Promise<T>;
export async function PromiseChainWTB<T>(listado: PromiseFunctionWTB<T>[], delay: number = 0, threads: number = 1): Promise<T[]> {
    const salida: T[] = [];
    const items: PromiseFunctionWTB<T>[] = [];
    for (let i = 0; i < threads; i++) {
        const item: PromiseFunctionWTB<T>|undefined = listado.shift();
        if (item) {
            items.push(item);
        }
    }
    if (items.length) {
        const itemResults = await Promise.all(items.map(item=>item()));
        if (delay>0) {
            await PromiseDelayed(delay);
        }
        salida.push(...itemResults);
        return salida.concat(await PromiseChainWTB(listado, delay, threads));
    }
    return salida;
}

export class PromiseTimeoutError extends Error {
    public constructor(public readonly ms: number) {
        super(`Timed out: The promise did not resolve within ${ms} milliseconds.`);

        Object.setPrototypeOf(this, new.target.prototype);

        this.name = "PromiseTimeoutError"; // imprescindible al extender clases nativas en TypeScript
    }
}

export async function PromiseTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
    return await Promise.race([
        promesa,
        PromiseDelayed(ms).then(()=>Promise.reject(new PromiseTimeoutError(ms))),
    ]);
}

type PromiseStatus = "OK"|"KO";
export interface IPromiseStatus<T> {
    status: PromiseStatus;
    result?: T;
    error?: any;
}
export async function PromiseAny<T>(promesas: Promise<T>[]): Promise<IPromiseStatus<T>[]> {
    return await Promise.all(promesas.map(promesa=>PromiseResult<T>(promesa)));
}
export async function PromiseResult<T>(promesa: Promise<T>): Promise<IPromiseStatus<T>> {
    return promesa.then((resultado: T)=>{
        return {
            status: "OK",
            result: resultado,
        } as IPromiseStatus<T>;
    }).catch((e)=>{
        return {
            status: "KO",
            error: e,
        } as IPromiseStatus<T>;
    });
}

type PromiseCreateFunction<T, K> = (item: K) => Promise<T>;
export function PromiseMap<T, K>(array: K[], createPromise: PromiseCreateFunction<T, K>): Promise<T>[] {
    const promesas: Promise<T>[] = [];
    for (const item of array) {
        promesas.push(createPromise(item));
    }
    return promesas;
}

export type DeferredState = "pending"|"fulfilled"|"rejected";

export class Deferred<T=void> {
    public promise: Promise<T>;
    public resolve!: (value: T | PromiseLike<T>) => void;
    public reject!: (reason?: any) => void;

    private status: DeferredState;

    // Refleja solo la primera liquidación: como en una Promise nativa, resolve/reject
    // posteriores son ignorados y no cambian el estado ya fijado.
    public get state(): DeferredState {
        return this.status;
    }

    public constructor() {
        this.status = "pending";
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = (value) => {
                if (this.status === "pending") {
                    this.status = "fulfilled";
                }
                resolve(value);
            };
            this.reject = (reason) => {
                if (this.status === "pending") {
                    this.status = "rejected";
                }
                reject(reason);
            };
        });
    }
}
