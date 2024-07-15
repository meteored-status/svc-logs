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

export function copyObject<T, K>(obj: NodeJS.Dict<T>, fn: (value: T)=>K): NodeJS.Dict<K> {
    const salida = {} as NodeJS.Dict<K>;
    for (const [key, value] of Object.entries(obj)) {
        salida[key] = fn(value as T);
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
