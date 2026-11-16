/**
 * Editor: Bixus
 * Fecha: Mon, 09 Nov 2026 07:46:18 GMT
 * Hash: 2dad58e8eed8d9988c6707da45dc4891
 * Versión: 2026.11.9+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Patrón que identifica el bloque de autoría al inicio de un fichero `.ts`.
 * Se excluye del cálculo del hash para que actualizar el comentario
 * (fecha, autor) no genere un hash diferente y evitar así falsos positivos en
 * los pushes sucesivos.
 *
 * Admite saltos de línea CRLF: un fichero que llega así desde Windows no se reconocía, y el envío
 * le ponía una cabecera nueva encima de la vieja en vez de sustituirla.
 */
const PATRON_AUTORIA = /^\/\*\*\r?\n \* Editor: [^\r\n]*\r?\n \* Fecha: [^\r\n]*\r?\n(?: \* Hash: [^\r\n]*\r?\n)?(?: \* Versión: [^\r\n]*\r?\n)?(?: \* Anterior: [^\r\n]*\r?\n)?(?: \* Proyecto: [^\r\n]*\r?\n)? \*\/\r?\n\r?\n/;

/** La versión del bloque de autoría, sin el `\r` de un fichero CRLF. */
const PATRON_VERSION_BLOQUE = /^ \* Versión: ([^\r\n]+)\r?$/m;

/**
 * Datos del bloque de autoría que estampa `mrpack framework --send`.
 *
 * @property autor    - Nombre del autor.
 * @property fecha    - Momento del envío.
 * @property hash     - Hash MD5 del cuerpo, sin el bloque.
 * @property version  - Versión del paquete que se envía.
 * @property anterior - Versión del bloque que había antes, si había.
 * @property proyecto - URL del repositorio desde el que se envía; vacía para omitir la línea.
 */
export interface IAutoria {
    autor: string;
    fecha: Date;
    hash: string;
    version: string;
    anterior?: string;
    proyecto: string;
}

/**
 * Elimina todos los bloques de autoría consecutivos del inicio del contenido.
 * Puede haber más de uno si un push anterior inyectó un bloque encima de otro
 * que aún no había sido limpiado.
 *
 * @param contenido - Texto completo del fichero `.ts`.
 * @returns Texto sin los bloques de autoría iniciales.
 */
export function stripAutoria(contenido: string): string {
    let resultado = contenido;
    while (PATRON_AUTORIA.test(resultado)) {
        resultado = resultado.replace(PATRON_AUTORIA, "");
    }
    return resultado;
}

/**
 * La versión que declara el bloque de autoría del fichero.
 *
 * @param contenido - Texto completo del fichero `.ts`.
 * @returns La versión, o `undefined` si el fichero no tiene bloque.
 */
export function versionAutoria(contenido: string): string|undefined {
    return PATRON_VERSION_BLOQUE.exec(contenido)?.[1];
}

/**
 * Pone el bloque de autoría delante del cuerpo, con el mismo salto de línea que use el cuerpo: si
 * es CRLF, el bloque también, para no dejar el fichero con los dos mezclados.
 *
 * @param cuerpo - Contenido del fichero sin bloque de autoría ({@link stripAutoria}).
 * @param autoria - Datos del bloque.
 * @returns El fichero completo.
 */
export function conAutoria(cuerpo: string, autoria: IAutoria): string {
    const lineas = [
        "/**",
        ` * Editor: ${autoria.autor}`,
        ` * Fecha: ${autoria.fecha.toUTCString()}`,
        ` * Hash: ${autoria.hash}`,
        ` * Versión: ${autoria.version}`,
    ];
    if (autoria.anterior!==undefined) {
        lineas.push(` * Anterior: ${autoria.anterior}`);
    }
    if (autoria.proyecto.length > 0) {
        lineas.push(` * Proyecto: ${autoria.proyecto}`);
    }
    lineas.push(" */", "", "");
    const eol = cuerpo.includes("\r\n") ? "\r\n" : "\n";

    return lineas.join(eol) + cuerpo;
}
