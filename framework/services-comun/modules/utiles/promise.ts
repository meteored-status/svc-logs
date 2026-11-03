/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 20 Oct 2026 13:12:58 GMT
 * Hash: bfb5a553a22d750cfbaa62dc3f0e5b79
 * Versión: 2026.10.20+4-juancmartinez
 * Anterior: 2026.9.23+3-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-api.git
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
    for (const actual of listado) {
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

/**
 * Resuelve con `promesa`, o rechaza con {@link PromiseTimeoutError} si tarda más de `ms`.
 *
 * El temporizador se cancela siempre, termine como termine `promesa`, para no dejar timers vivos (un timer pendiente mantiene vivo el proceso
 * hasta que vence). Si gana el temporizador, el posterior rechazo de `promesa` queda atendido por la propia carrera, así que tampoco genera un
 * rechazo sin atender.
 *
 * No cancela la operación: solo deja de esperarla. Quien la lanza debe acotarla por su lado.
 */
export async function PromiseTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
    const vencido = new Deferred<never>();
    const temporizador = setTimeout(()=>{
        vencido.reject(new PromiseTimeoutError(ms));
    }, ms);

    try {
        return await Promise.race([promesa, vencido.promise]);
    } finally {
        clearTimeout(temporizador);
    }
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

/**
 * Limita cuántas tareas asíncronas corren a la vez; las demás esperan su turno, por orden de llegada.
 *
 * Funciona con «carriles»: cada carril es la promesa de la tarea que lleva en curso. Un turno (encadenado, para que los que llegan se
 * coloquen de uno en uno y por orden) espera a que algún carril quede libre y arranca ahí la tarea. No hace falta capturar `resolve`/`reject`
 * de ninguna promesa: todo son encadenamientos de las que ya hay.
 */
export class Semaforo {
    /* INSTANCE */

    private readonly carriles: Promise<void>[];
    private turno: Promise<void>;

    /**
     * @param maximo - Tareas que pueden correr a la vez. Entero mayor o igual que 1; si no, lanza `RangeError`.
     */
    public constructor(maximo: number) {
        if (!Number.isInteger(maximo) || maximo < 1) {
            throw new RangeError(`Semaforo: el máximo debe ser un entero mayor o igual que 1 (recibido: ${maximo})`);
        }

        this.carriles = Array.from({length: maximo}, ()=>Promise.resolve());
        this.turno = Promise.resolve();
    }

    /**
     * Ejecuta `tarea` cuando haya un carril libre y devuelve su resultado. Si la tarea falla —incluso si lanza de forma síncrona—, el carril
     * queda libre igualmente y solo rechaza a su llamador.
     */
    public async run<T>(tarea: ()=>Promise<T>): Promise<T> {
        const colocada = this.turno.then(async ()=>{
            const libre = await Promise.race(this.carriles.map((carril, i)=>carril.then(()=>i)));
            const ejecucion = tarea();
            this.carriles[libre] = ejecucion.then(()=>undefined, ()=>undefined);

            // En un objeto, para que el turno no espere a que termine la tarea: solo a que ocupe su carril
            return {ejecucion};
        });
        this.turno = colocada.then(()=>undefined, ()=>undefined);

        return (await colocada).ejecucion;
    }
}
