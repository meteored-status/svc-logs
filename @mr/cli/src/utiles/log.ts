/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: c61e8642451df1ebd4728f5519da644f
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

/**
 * Fork local mínimo de `services-comun/modules/utiles/log.ts`, con solo las funciones
 * (`info`, `warning`, `error`) que usa el código propio de `@mr/cli` (`mrpack`/`mrlang`).
 *
 * A diferencia del original, no depende de `dd-trace` ni gestiona los modos
 * `KUBERNETES`/`DATADOG`: `mrpack`/`mrlang` se ejecutan siempre en local/CI, nunca dentro
 * de un pod de Kubernetes ni con el tracer de Datadog activo, así que esa lógica no aporta
 * nada aquí y solo añadía una dependencia innecesaria en el bundle de la CLI.
 */

export function info(...txt: any[]): void {
    if (txt.length>0) {
        console.info(...txt);
    }
}

export function warning(...txt: any[]): void {
    if (txt.length>0) {
        console.warn(...txt);
    }
}

export function error(...txt: any[]): void {
    if (txt.length>0) {
        console.error(...txt);
    }
}
