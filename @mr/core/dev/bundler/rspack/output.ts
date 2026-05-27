/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 21 May 2026 06:51:30 GMT
 * Hash: 984273ce026e9fe912f57c7da3aabc58
 * Versión: 2026.5.21+1-josantoniojimnez
 */

import path from "node:path";
import {type Filename, type Output as TOutput} from "@rspack/core";

import {Runtime} from "@mr/core-dev/manifest/deployment";

/**
 * Configuración del directorio y formato de ficheros de salida.
 *
 * @property basedir    - Directorio raíz del workspace.
 * @property desarrollo - `true` en entorno de desarrollo (usa nombres de chunk sin hash).
 * @property cssCritico - `true` cuando el CSS usa la estrategia `critical` (salida en `output/critical`).
 */
interface IOutputConfig {
    basedir: string;
    desarrollo: boolean;
    cssCritico: boolean;
}

/**
 * Genera la sección `output` de la configuración de rspack.
 *
 * Las instancias de esta clase satisfacen directamente el tipo `Output` de rspack,
 * por lo que se usan sin conversión en la configuración final.
 *
 * | Runtime   | Directorio de salida | Nombre de fichero |
 * |-----------|---------------------|-------------------|
 * | `node`    | `output/`           | `[name].js` |
 * | `browser` | `output/bundle/` o `output/critical/` | desarrollo: `[name].js`; producción: `[name]/[contenthash].js` |
 *
 * @property uniqueName    - Nombre único del bundle; se usa como prefijo para evitar colisiones entre bundles paralelos.
 * @property path          - Ruta absoluta al directorio de salida.
 * @property filename      - Patrón de nombre para el fichero de entrada principal.
 * @property chunkFilename - Patrón de nombre para los chunks secundarios (opcional).
 * @property clean         - Si `true`, rspack limpia el directorio de salida antes de cada build.
 */
export class Output implements TOutput {
    public readonly uniqueName: string;
    public readonly path: string;
    public readonly filename: Filename;
    public readonly chunkFilename?: Filename;
    public readonly clean: boolean;

    public constructor(filename: Filename, basedir: string, output: string, clean: boolean, chunkFilename?: Filename) {
        this.filename = filename;
        this.chunkFilename = chunkFilename;
        this.path = path.resolve(basedir, output);
        this.uniqueName = path.basename(basedir);
        this.clean = clean;
    }

    /** Configuración de salida para un bundle Node.js. */
    protected static buildNode({basedir}: IOutputConfig): Output {
        return new this("[name].js", basedir, "output", false);
    }

    /**
     * Configuración de salida para un bundle browser.
     * En producción los nombres incluyen `[contenthash]` para invalidar la caché del navegador.
     */
    protected static buildBrowser({basedir, desarrollo, cssCritico}: IOutputConfig): Output {
        const output = cssCritico ? "output/critical" : "output/bundle";
        const filename = desarrollo ? "[name].js" : "[name]/[contenthash].js";
        return new this(filename, basedir, output, true);
    }

    /**
     * @param runtime - Runtime del bundle.
     * @param config  - Configuración de salida.
     * @throws {Error} Si el runtime no está soportado.
     */
    public static build(runtime: Runtime, config: IOutputConfig): Output {
        switch (runtime) {
            case Runtime.node:
                return this.buildNode(config);
            case Runtime.browser:
                return this.buildBrowser(config);
            default:
                throw new Error(`Runtime no soportado: ${runtime}`);
        }
    }
}
