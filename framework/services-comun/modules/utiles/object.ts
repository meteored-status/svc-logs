export function mergeDeep(target: any, ...sources: any[]): any {
    if (!sources.length) return target;
    const source = sources.shift();
    if (source) {
        for (const key in source) {
            if (typeof source[key] === 'object') {
                if (!target[key]) Object.assign(target, {[key]: {}});
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, {[key]: source[key]});
            }
        }
    }
    return mergeDeep(target, ...sources);
}

export function dynamicProperty(obj: any, prop: string): any {
    return prop.split('.').reduce((object, key) => {
        return object && object[key];
    }, obj);
}

export function copyObject<T, K>(obj: Record<string, T>, fn: (value: T)=>K): Record<string, K> {
    const salida = {} as Record<string, K>;
    for (const key of Object.keys(obj)) {
        salida[key] = fn(obj[key]);
    }

    return salida;
}

export function immute<T>(obj: T): T {
    for (const key in obj) {
        if (typeof obj[key] === 'object' && !Object.isSealed(obj[key]) && !Object.isFrozen(obj[key])) {
            obj[key] = immute(obj[key]);
        }
    }
    return Object.freeze(Object.seal(obj));
}
