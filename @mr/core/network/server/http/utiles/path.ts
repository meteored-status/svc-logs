/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 11:19:03 GMT
 * Hash: e4b3f35b7bb78b6b9a42542d8e81aa3a
 * Versión: 2026.5.18+3-josantoniojimnez
 * Anterior: 2026.5.18+2-josantoniojimnez
 */

import path from "node:path";

/**
 * Errores devueltos por {@link assertSafePath} cuando la ruta resuelta queda fuera
 * del directorio base permitido. Diferente de `Error` para que los handlers puedan
 * identificar este caso específico y devolver el `403`/`404` adecuado.
 */
export class UnsafePathError extends Error {
    public readonly basedir: string;
    public readonly requested: string;
    public readonly resolved: string;

    public constructor(basedir: string, requested: string, resolved: string) {
        super(`Ruta '${requested}' fuera de '${basedir}' (resuelto: '${resolved}')`);
        // Necesario al extender `Error` en TS para que `instanceof UnsafePathError`
        // funcione tras pasar por el transpilado (la cadena de prototipos se rompe
        // en `super(...)` si no se restaura explícitamente).
        Object.setPrototypeOf(this, UnsafePathError.prototype);
        this.name = "UnsafePathError";
        this.basedir = basedir;
        this.requested = requested;
        this.resolved = resolved;
    }
}

/**
 * Resuelve y valida que una ruta de fichero relativa permanece dentro de un
 * directorio base. Previene **path traversal** (`../../etc/passwd`) en handlers que
 * sirven ficheros estáticos a partir de segmentos capturados de la URL.
 *
 * Lanza {@link UnsafePathError} si la ruta resuelta escapa del directorio base.
 *
 * ### Ejemplo
 * ```ts
 * const file = assertSafePath("assets", coincidencias[0]); // p. ej. "assets/img/logo.png"
 * conexion.sendStream(fs.createReadStream(file));
 * ```
 *
 * @param basedir   - Directorio raíz permitido (relativo o absoluto).
 * @param requested - Ruta relativa pedida por el cliente; típicamente un grupo capturado.
 * @returns Ruta absoluta normalizada dentro de `basedir`, lista para usar con `fs`.
 * @throws {UnsafePathError} si la ruta resuelta queda fuera de `basedir`.
 */
export function assertSafePath(basedir: string, requested: string): string {
    const base = path.resolve(basedir);
    const limpia = requested.replace(/^\/+/, "");
    const candidato = path.resolve(base, limpia);

    // `candidato` debe empezar exactamente por `base` + separador, o ser igual a `base`.
    const sep = path.sep;
    if (candidato !== base && !candidato.startsWith(base + sep)) {
        throw new UnsafePathError(base, requested, candidato);
    }

    return candidato;
}

