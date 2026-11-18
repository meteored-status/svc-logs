/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 14:36:40 GMT
 * Hash: 861c98f4eb5fdf4811cd62426703d2ef
 * Versión: 2026.11.16+8-bixus
 * Anterior: 2026.11.16+7-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Contenido de `instrumentation.ts` en un workspace Next.js: arranca el heartbeat de pods. Es el mismo en todos los proyectos.
 * `register()` lo llama Next una vez por proceso, antes de servir; la guarda `NEXT_RUNTIME` quita el `import()` del runtime edge.
 * Lo documenta `@mr/core-workload` (README, «Servicios Next»).
 */
export const CONTENIDO_INSTRUMENTATION = `export async function register(): Promise<void> {
    if (process.env["NEXT_RUNTIME"] === "nodejs") {
        (await import("@mr/core-workload/heartbeat/next")).iniciarHeartbeatNext();
    }
}
`;

/**
 * Lo que tiene que aparecer en un `instrumentation.*` para darlo por válido: la llamada que arranca el heartbeat.
 */
export const MARCA_INSTRUMENTATION = "iniciarHeartbeatNext";

/**
 * Dónde puede estar la instrumentación de Next: en la raíz del workspace o en `src/`, con las extensiones que acepta.
 */
export const CANDIDATOS_INSTRUMENTATION: readonly string[] = ["instrumentation", "src/instrumentation"]
    .flatMap((base) => ["ts", "js", "tsx", "jsx", "mts", "mjs", "cts", "cjs"].map((extension) => `${base}.${extension}`));

/**
 * Fichero que genera `mrpack init`.
 */
export const RUTA_INSTRUMENTATION = "instrumentation.ts";

/**
 * Un `instrumentation.*` que ya existe en el workspace.
 *
 * @property ruta - Ruta relativa al workspace.
 * @property contenido - Su contenido.
 */
export interface IInstrumentationExistente {
    ruta: string;
    contenido: string;
}

/**
 * Lo que hay que hacer con la instrumentación de un workspace.
 *
 * @property crear - Hay que crear {@link RUTA_INSTRUMENTATION}: no existe ninguna.
 * @property avisos - Avisos para quien lanza `init` (un `instrumentation.*` ajeno que no se toca).
 */
export interface IDecisionInstrumentation {
    crear: boolean;
    avisos: string[];
}

/**
 * Si un workspace lleva `instrumentation.ts`: solo los de Node con framework Next.js.
 *
 * @param config.framework - `build.framework` del manifest.
 * @param config.runtime - `deploy.runtime` del manifest.
 */
export function aplicaInstrumentation({framework, runtime}: {framework: string; runtime: string}): boolean {
    return runtime === "node" && framework === "nextjs";
}

/**
 * Fichero del emisor dentro del monorepo. Sin él (un `@mr/core-workload` anterior al heartbeat de Next) `instrumentation.ts` no
 * compilaría, así que no se genera.
 */
export const RUTA_EMISOR_INSTRUMENTATION = "@mr/core/workload/heartbeat/next/index.ts";

/**
 * Qué hacer con un workspace: si se genera `instrumentation.ts` y se añade la dependencia, y el aviso si no se puede.
 *
 * @property aplicar - Generar `instrumentation.ts` y añadir `@mr/core-workload` a las `devDependencies`.
 * @property aviso - Por qué no, cuando es algo que hay que arreglar (el monorepo no trae el emisor).
 */
export interface IPlanInstrumentation {
    aplicar: boolean;
    aviso: string|null;
}

/**
 * Plan de un workspace: solo los Next.js de Node y habilitados, y solo si el monorepo trae el emisor
 * ({@link RUTA_EMISOR_INSTRUMENTATION}); si no, no se toca nada y se avisa de que hay que actualizar el framework.
 *
 * @param config.framework - `build.framework` del manifest.
 * @param config.runtime - `deploy.runtime` del manifest.
 * @param config.enabled - Si el workspace está habilitado.
 * @param config.emisorDisponible - Si existe {@link RUTA_EMISOR_INSTRUMENTATION} en el monorepo.
 */
export function planificarInstrumentation({framework, runtime, enabled, emisorDisponible}: {framework: string; runtime: string; enabled: boolean; emisorDisponible: boolean}): IPlanInstrumentation {
    if (!enabled || !aplicaInstrumentation({framework, runtime})) {
        return {aplicar: false, aviso: null};
    }
    if (!emisorDisponible) {
        return {aplicar: false, aviso: `no se genera instrumentation.ts ni se añade @mr/core-workload: este monorepo no trae ${RUTA_EMISOR_INSTRUMENTATION}. Actualiza el framework (mrpack update) y vuelve a lanzar init.`};
    }

    return {aplicar: true, aviso: null};
}

/**
 * Decide qué hacer con la instrumentación de un workspace Next.js, dados los `instrumentation.*` que ya tiene:
 *
 * - Ninguno: se crea.
 * - Alguno llama a {@link MARCA_INSTRUMENTATION}: ya está, no se toca nada (si solo está en `src/`, se avisa: el `buildId` no lo vigila).
 * - Hay alguno y ninguno la llama: es de otro y **no se pisa**; se avisa, porque ese servicio no emitirá heartbeat.
 *
 * @param existentes - Los `instrumentation.*` del workspace.
 */
export function decidirInstrumentation(existentes: IInstrumentationExistente[]): IDecisionInstrumentation {
    if (existentes.length === 0) {
        return {crear: true, avisos: []};
    }
    const validos = existentes.filter(({contenido}) => contenido.includes(MARCA_INSTRUMENTATION));
    if (validos.length > 0) {
        // El `buildId` (`next.config.js` de `services-comun`) solo mira `instrumentation.*` en la raíz del proyecto.
        const enSrc = validos.every(({ruta}) => ruta.startsWith("src/"));

        return {crear: false, avisos: enSrc ? [`${validos[0].ruta} arranca el heartbeat, pero el buildId solo vigila instrumentation.* en la raíz del workspace: un cambio en el emisor no generaría imagen nueva. Muévelo a la raíz.`] : []};
    }

    return {
        crear: false,
        avisos: existentes.map(({ruta}) => `${ruta} ya existe y no llama a ${MARCA_INSTRUMENTATION}(): no se toca y este servicio no emitirá heartbeat de pods. Añade dentro de register(), solo en el runtime "nodejs": (await import("@mr/core-workload/heartbeat/next")).${MARCA_INSTRUMENTATION}();`),
    };
}

/**
 * Deja en `devDependencies` lo que necesita `instrumentation.ts`: `@mr/core-workload` (se empaqueta, como `@mr/core-network`). `dd-trace`
 * ya lo asegura `checkDependencies` para todos los workspaces.
 *
 * @param devDependencies - `devDependencies` del `package.json` (mutado in-place).
 */
export function dependenciasInstrumentation(devDependencies: Record<string, string>): void {
    devDependencies["@mr/core-workload"] ??= "workspace:*";
}

/**
 * Lo que {@link comprobarInstrumentation} necesita del disco de un workspace (rutas relativas a él).
 *
 * @property leer - Contenido de un fichero, o `null` si no existe.
 * @property escribir - Crea un fichero que no existe.
 */
export interface IDiscoInstrumentation {
    leer(ruta: string): Promise<string|null>;
    escribir(ruta: string, contenido: string): Promise<void>;
}

/**
 * Deja la instrumentación de un workspace Next.js como dice {@link decidirInstrumentation}: crea {@link RUTA_INSTRUMENTATION} si no hay
 * ningún `instrumentation.*`. **Nunca reescribe ni pisa uno que existe**, así que es idempotente y no toca el de otro.
 *
 * @param disco - El disco del workspace.
 * @returns Lo decidido, con los avisos para quien lanza `init`.
 */
export async function comprobarInstrumentation(disco: IDiscoInstrumentation): Promise<IDecisionInstrumentation> {
    const existentes: IInstrumentationExistente[] = [];
    for (const ruta of CANDIDATOS_INSTRUMENTATION) {
        const contenido = await disco.leer(ruta);
        if (contenido !== null) {
            existentes.push({ruta, contenido});
        }
    }
    const decision = decidirInstrumentation(existentes);
    if (decision.crear) {
        await disco.escribir(RUTA_INSTRUMENTATION, CONTENIDO_INSTRUMENTATION);
    }

    return decision;
}
