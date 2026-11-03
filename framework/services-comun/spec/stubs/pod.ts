/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 02 Nov 2026 11:05:48 GMT
 * Hash: 9dc097d174bec4db4af6f74a4f155887
 * Versión: 2026.11.2+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-cmp.git
 */

/**
 * Sustituto, solo para las pruebas, de `@mr/core-workload/config/pod` (ver `paths` en `tsconfig.spec.json`).
 *
 * Muchos módulos de `services-comun` importan `IPodInfo` solo como tipo. Con la resolución `node16` de las pruebas, TypeScript
 * comprueba también el fichero real (`@mr/core-workload`, que es ESM) y falla al compilar, aunque el `import type` no genere código. Con este
 * stub un módulo así se puede importar desde una prueba. Solo declara lo que esos módulos usan.
 */

export type IPodInfo = Readonly<{
    servicio: string;
}>;
