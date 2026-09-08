/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: d52fff04b53e916be48a223cb0aa035d
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Fork mínimo de `services-comun/modules/utiles/log.ts`, con solo las funciones
 * (`info`, `warning`, `error`) que usan las herramientas de línea de comandos del monorepo:
 * `mrpack` (`@mr/cli`) y `mrlang` (`@mr/core-i18n`).
 *
 * A diferencia del original, no depende de `dd-trace` ni gestiona los modos
 * `KUBERNETES`/`DATADOG`: las CLI se ejecutan siempre en local/CI, nunca dentro de un pod de
 * Kubernetes ni con el tracer de Datadog activo, así que esa lógica no aporta nada aquí y solo
 * añadía una dependencia innecesaria en sus bundles.
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
