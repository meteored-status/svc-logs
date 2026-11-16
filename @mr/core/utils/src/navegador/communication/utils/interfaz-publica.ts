/**
 * Editor: miguel
 * Fecha: Fri, 13 Nov 2026 07:54:06 GMT
 * Hash: a8c03c4eef51e958a58d572ec582f886
 * Versión: 2026.11.13+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import type {TWhen} from "../eventos";

/**
 * Cómo emite una interfaz: el `emit` de `Comunicacion`, que pone el `origin`.
 */
export type TEmitir = (componente: string, metodo: string, when: TWhen, message: {value: unknown}) => void;

/**
 * Envuelve cada entrada de la interfaz del componente `nombre` para que, al llamarla, emita `before` (con los argumentos) y `after` (con lo que devuelve; si devuelve una promesa, al
 * resolverse) por `emitir`. Vale igual para métodos que para los setters de atributos.
 */
export function emitirInterfazPublica<T>(interfaz: InterfazPublica<T>, nombre: string, emitir: TEmitir): InterfazPublica<T> {
    const original = interfaz as Record<string, (...args: unknown[]) => unknown>;
    const envuelta: Record<string, (...args: unknown[]) => unknown> = {};

    for (const miembro of Object.keys(original)) {
        const llamar = original[miembro];
        envuelta[miembro] = (...args) => {
            emitir(nombre, miembro, "before", {value: args});
            const resultado = llamar?.(...args);
            if (resultado instanceof Promise) {
                return resultado.then((valor: unknown) => {
                    emitir(nombre, miembro, "after", {value: valor});

                    return valor;
                });
            }
            emitir(nombre, miembro, "after", {value: resultado});

            return resultado;
        };
    }

    return envuelta as InterfazPublica<T>;
}

/**
 * Devuelve una interfaz con los set y métodos definidos como públicos, no los get.
 */

export type InterfazPublica<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any
        ? T[K]                   // métodos: misma firma
        : (valor: T[K]) => void; // atributos y accesores: setter
};

export default function crearInterfazPublica<T extends object>(instancia: T): InterfazPublica<T> {
    const interfaz: Record<string, (...args: any[]) => any> = {};

    // Se recorre la instancia y su cadena de prototipos: lo primero que se encuentra (la instancia antes que el prototipo) manda. Se guarda lo que hay ahora (la función o el
    // setter), no `instancia[nombre]`: si la instancia acaba con la versión envuelta en su lugar, la interfaz sigue llamando al original y no hay recursión ni doble emisión.
    for (let objeto: object | null = instancia; objeto && objeto !== Object.prototype; objeto = Object.getPrototypeOf(objeto) as object | null) {
        for (const nombre of Object.getOwnPropertyNames(objeto)) {
            if (nombre === "constructor" || nombre in interfaz) {
                continue;
            }
            // El descriptor evita ejecutar los getters.
            const {value, set} = Object.getOwnPropertyDescriptor(objeto, nombre) as PropertyDescriptor;
            if (typeof value === "function") {
                interfaz[nombre] = (...args: any[]) => value.apply(instancia, args);
            } else if (set) {
                interfaz[nombre] = (valor: any) => {
                    set.call(instancia, valor);
                };
            } else if (objeto === instancia) {
                interfaz[nombre] = (valor: any) => {
                    (instancia as Record<string, unknown>)[nombre] = valor;
                };
            }
        }
    }

    return interfaz as InterfazPublica<T>;
}
