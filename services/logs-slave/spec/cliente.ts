import type {Cliente} from "../modules/data/cliente";

/**
 * Doble de `Cliente` para las pruebas.
 *
 * `Cliente` real arrastra `ClienteError` → `services-comun`, que en este monorepo se distribuye
 * como fuente TypeScript sin compilar y por tanto no se puede cargar desde las pruebas ya
 * compiladas. `Registro` y el parser solo usan `id`, `grupo`, `backends` y `proyecto()`, así que
 * un doble con esa superficie es suficiente y mantiene las pruebas en la lógica pura.
 */
export const cliente = (id: string, grupo?: string, backends: Record<string, string> = {}): Cliente => ({
    id,
    grupo,
    backends,
    proyecto: (service?: string) => grupo ?? service,
} as Cliente);
