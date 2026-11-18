/**
 * Editor: miguel
 * Fecha: Wed, 18 Nov 2026 11:11:39 GMT
 * Hash: 2a51c02d32a0c1cb2e7d1325f71c9883
 * Versión: 2026.11.18+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

/**
 * Qué se hace alrededor de cada método y de cada setter de la instancia (`interceptarMiembros`).
 *
 * @property antes - Antes de ejecutarlo, con los argumentos (en un setter, el valor que se asigna).
 * @property despues - Después, con lo que devuelve (si devuelve una promesa, al resolverse) o, en un setter, con el valor que queda.
 * @property omitir - Los miembros por nombre que no se interceptan.
 */
export interface IInterceptor {
    antes?(miembro: string, args: unknown[]): void;
    despues?(miembro: string, valor: unknown): void;
    omitir?(miembro: string): boolean;
}

/**
 * Las instancias ya interceptadas: hacerlo dos veces no envuelve dos veces.
 */
const interceptadas = new WeakSet<object>();

/**
 * Sustituye en la instancia (solo en esa, no en la clase) cada método y cada setter, suyo o de su cadena de prototipos, por una versión que llama a `antes` y a `despues` alrededor
 * del original. Así `instancia.metodo()` o `instancia.atributo = x` pasan por ahí vengan de donde vengan. Los atributos que no son funciones ni accesores, y los getters sin setter,
 * no se tocan. No sabe nada de para qué se usa. Hay que llamarla con la instancia ya construida.
 */
export function interceptarMiembros(instancia: object, {antes, despues, omitir}: IInterceptor): void {
    if (interceptadas.has(instancia)) {
        return;
    }
    interceptadas.add(instancia);
    const vistos = new Set<string>(["constructor"]);
    for (let objeto: object | null = instancia; objeto && objeto !== Object.prototype; objeto = Object.getPrototypeOf(objeto) as object | null) {
        for (const nombre of Object.getOwnPropertyNames(objeto)) {
            if (vistos.has(nombre)) {
                continue;
            }
            vistos.add(nombre);
            if (omitir?.(nombre)) {
                continue;
            }
            const {value, get, set, enumerable} = Object.getOwnPropertyDescriptor(objeto, nombre) as PropertyDescriptor;
            if (typeof value === "function") {
                Object.defineProperty(instancia, nombre, {value: envolverMetodo(instancia, nombre, value as (...args: unknown[]) => unknown, {antes, despues}), writable: true, enumerable, configurable: true});
            } else if (set) {
                const asignar = (valor: unknown): void => {
                    antes?.(nombre, [valor]);
                    set.call(instancia, valor);
                    despues?.(nombre, get?.call(instancia));
                };
                Object.defineProperty(instancia, nombre, {get, set: asignar, enumerable, configurable: true});
            }
        }
    }
}

function envolverMetodo(instancia: object, nombre: string, original: (...args: unknown[]) => unknown, {antes, despues}: IInterceptor): (...args: unknown[]) => unknown {
    return (...args) => {
        antes?.(nombre, args);
        const resultado = original.apply(instancia, args);
        if (resultado instanceof Promise) {
            return resultado.then((valor: unknown) => {
                despues?.(nombre, valor);

                return valor;
            });
        }
        despues?.(nombre, resultado);

        return resultado;
    };
}
