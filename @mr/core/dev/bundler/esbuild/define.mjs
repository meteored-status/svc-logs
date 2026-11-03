/**
 * Variables globales que esbuild sustituye por su valor al empaquetar.
 *
 * Vive aparte de `esbuild.config.mjs` porque ese fichero lanza su compilación al importarse, y aquí hace falta
 * importar solo esto: `pubsub/evaluar.mjs` empaqueta los `mrpack.pubsub.ts` con los mismos `define` que el build
 * de desarrollo de un servicio, para que `DESARROLLO ? … : …` se evalúe igual que en el código.
 *
 * @param config - Entorno y, si el workspace la declara, la base de datos activa.
 * @returns Mapa para la opción `define` de esbuild (`DESARROLLO`, `TEST`, `PRODUCCION`, `ENTORNO`, `NEXTJS`, `DATABASE`
 *   y sus versiones `global.*`).
 */
export function getDefine({entorno, database}) {
    const desarrollo = entorno === "desarrollo";
    return {
        DESARROLLO: JSON.stringify(desarrollo),
        TEST: JSON.stringify(entorno === "test"),
        PRODUCCION: JSON.stringify(!desarrollo),
        ENTORNO: JSON.stringify(entorno),
        NEXTJS: JSON.stringify(false),
        DATABASE: JSON.stringify(database??""),
        "global.DESARROLLO": JSON.stringify(desarrollo),
        "global.TEST": JSON.stringify(entorno === "test"),
        "global.PRODUCCION": JSON.stringify(!desarrollo),
        "global.ENTORNO": JSON.stringify(entorno),
        "global.NEXTJS": JSON.stringify(false),
        "global.DATABASE": JSON.stringify(database??""),
    };
}
