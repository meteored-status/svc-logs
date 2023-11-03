import {Error} from "../net/error";
import {RequestError} from "../net/request";
import {PromiseDelayed} from "../utiles/promise";

declare var PRODUCCION: boolean;
declare var TEST: boolean;

// type TDecoratorBuilder = (target: any, propertyKey: string, descriptor: PropertyDescriptor)=>void;

interface IPrint {
    target: Object | Function;
    propertyKey: string;
    prefix?: string;
}

function decoratorPrint({target, propertyKey, prefix}: IPrint, ...args: any[]): void {
    const print: string[] = [];
    if (prefix!=undefined) {
        print.push(prefix);
    }
    if (!PRODUCCION || prefix==undefined) {
        switch (typeof target) {
            case "function":
                print.push(`${target.name}::${propertyKey}()`);
                break;
            case "object":
                print.push(`${target.constructor.name}->${propertyKey}()`);
                break;
            default:
                print.push(`=>${propertyKey}()`);
                break;
        }
    }
    if (!PRODUCCION) {
        console.warn(" Decorator", ...print, ...args);
    } else {
        console.warn("Decorator", ...print, ...args);
    }
}

function parseParams(a?: boolean|string, b?: boolean|string): {forzar: boolean, prefix?: string} {
    let forzar=false;
    let prefix: string|undefined;
    if (typeof a=="boolean") {
        forzar = a;
        if (typeof b == "string") {
            prefix = b;
        }
    } else {
        prefix = a;
        if (typeof b == "boolean") {
            forzar = b;
        }
    }

    return { forzar, prefix };
}

export function logCall(): Function;
export function logCall(prefix: string): Function;
export function logCall(forzar: boolean): Function;
export function logCall(prefix: string, forzar: boolean): Function;
export function logCall(forzar: boolean, prefix: string): Function;
export function logCall(a?: boolean|string, b?: boolean|string): Function {
    const {forzar, prefix} = parseParams(a, b);

    return (originalMethod: any, context: ClassMethodDecoratorContext)=>{
        const methodName = String(context.name);

        return function (this: any, ...args: any[]) {
            if (PRODUCCION && (!TEST || !forzar)) {
                return originalMethod.call(this, ...args);
            }

            decoratorPrint({target: this, propertyKey: methodName, prefix}, "invocado");

            return originalMethod.apply(this, args);
        }
    }
}

export function logRejection(): Function;
export function logRejection(prefix: string): Function;
export function logRejection(forzar: boolean): Function;
export function logRejection(prefix: string, forzar: boolean): Function;
export function logRejection(forzar: boolean, prefix: string): Function;
export function logRejection(a?: boolean|string, b?: boolean|string): Function {
    const {forzar, prefix} = parseParams(a, b);

    return (originalMethod: any, context: ClassMethodDecoratorContext)=>{
        const methodName = String(context.name);

        return function (this: any, ...args: any[]) {
            if (PRODUCCION && (!TEST || !forzar)) {
                return originalMethod.call(this, ...args);
            }

            if (originalMethod.constructor.name != "AsyncFunction") {
                return originalMethod.call(this, ...args);
            }

            return originalMethod.apply(this, args)
                .catch(async (err: PromiseRejectedResult | Error | TypeError | RequestError)=>{
                    if (err instanceof Error) {
                        return Promise.reject(err);
                    }

                    if (err instanceof RequestError) {
                        decoratorPrint({target: this, propertyKey: methodName, prefix}, "Promesa rechazada", err.toString());
                        return Promise.reject(err);
                    }

                    decoratorPrint({target: this, propertyKey: methodName, prefix}, "Promesa rechazada", err);
                    return Promise.reject(err);
                });
        }
    }
}

export function logResolve(): Function;
export function logResolve(prefix: string): Function;
export function logResolve(forzar: boolean): Function;
export function logResolve(prefix: string, forzar: boolean): Function;
export function logResolve(forzar: boolean, prefix: string): Function;
export function logResolve(a?: boolean|string, b?: boolean|string): Function {
    const {forzar, prefix} = parseParams(a, b);

    return (originalMethod: any, context: ClassMethodDecoratorContext)=>{
        const methodName = String(context.name);

        return function (this: any, ...args: any[]) {
            if (PRODUCCION && (!TEST || !forzar)) {
                return originalMethod.call(this, ...args);
            }

            if (originalMethod.constructor.name != "AsyncFunction") {
                return originalMethod.call(this, ...args);
            }

            return originalMethod.apply(this, args)
                .then(async (data: any) => {
                    decoratorPrint({target: this, propertyKey: methodName, prefix}, "Promesa resuelta", data);
                    return data;
                });
        }
    }
}

export function logTime(): Function;
export function logTime(prefix: string): Function;
export function logTime(forzar: boolean): Function;
export function logTime(prefix: string, forzar: boolean): Function;
export function logTime(forzar: boolean, prefix: string): Function;
export function logTime(a?: boolean|string, b?: boolean|string): Function {
    const {forzar, prefix} = parseParams(a, b);

    return (originalMethod: any, context: ClassMethodDecoratorContext)=>{
        const methodName = String(context.name);

        return function (this: any, ...args: any[]) {
            if (PRODUCCION && (!TEST || !forzar)) {
                return originalMethod.call(this, ...args);
            }

            const time = Date.now();

            const salida = originalMethod.apply(this, args);
            if (originalMethod.constructor.name == "AsyncFunction") {
                return salida.then(async (data: any)=>{

                    decoratorPrint({target: this, propertyKey: methodName, prefix}, Date.now() - time, "ms");

                    return data;
                })
            }

            decoratorPrint({target: this, propertyKey: methodName, prefix}, Date.now() - time, "ms");

            return salida;
        }
    }
}

export function postpone(originalMethod: any, context: ClassMethodDecoratorContext) {
    if (originalMethod.constructor.name == "AsyncFunction") {
        return async function (this: any, ...args: any[]) {
            await PromiseDelayed();
            return originalMethod.apply(this, args);
        };
    }

    return function (this: any, ...args: any[]) {
        return originalMethod.call(this, ...args);
    }
}
