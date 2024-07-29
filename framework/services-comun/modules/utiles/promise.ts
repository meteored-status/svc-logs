// import {setTimeout} from 'node:timers/promises';
//
// export {setTimeout as PromiseDelayed};

export async function PromiseDelayed(delay: number = 0): Promise<void> {
    // if (delay>0) {
    return new Promise<void>((resolve: Function) => {
        setTimeout(() => {
            resolve();
        }, delay);
    });
    // }
    // return new Promise<void>((resolve: Function) => {
    //     setImmediate(() => {
    //         resolve();
    //     });
    // });
}

// deprecated => usar "postpone" de modules/decorators/metodo.ts
// export function postponeMethod(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
//     const newProperty = `promisePostpone_${propertyKey}`;
//
//     target[newProperty] = descriptor.value;
//
//     if (descriptor.value.constructor.name == "AsyncFunction") {
//         descriptor.value = async function (...args: any[]) {
//             await PromiseDelayed();
//             return target[newProperty].apply(this, args);
//         };
//     }
// }

// type PromiseFunction<T> = ()=>Promise<T>;
// type PromiseProgress<T> = (resultado: T)=>void;
// export async function PromiseChain<T>(listado: PromiseFunction<T>[], progress?: PromiseProgress<T>): Promise<T[]> {
//     const salida:T[] = [];
//
//     for (let actual of listado) {
//         const resultado = await actual();
//         salida.push(resultado);
//         if (progress) {
//             setImmediate(()=>{
//                 progress(resultado);
//             });
//         }
//     }
//
//     return salida;
// }

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
        super("Timed out");
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
