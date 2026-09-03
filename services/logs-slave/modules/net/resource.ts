/**
 * Prefijo literal del `resourceName` de un Cloud Audit Log de Cloud Storage.
 * Su forma completa es `projects/_/buckets/<bucket>/objects/<path>`.
 */
const PREFIJO_BUCKET = "projects/_/buckets/";
const SEPARADOR_OBJETO = "/objects/";

/**
 * Objeto de Cloud Storage al que apunta una notificación.
 *
 * @property bucket - Nombre del bucket.
 * @property path   - Ruta del objeto dentro del bucket.
 */
export interface IRecurso {
    bucket: string;
    path: string;
}

/**
 * Descompone el `resourceName` de la notificación en bucket + ruta del objeto.
 *
 * @returns `undefined` si no tiene la forma esperada, en vez de devolver un bucket cortado por el
 *          sitio equivocado como haría un `substring` con la longitud del prefijo cableada.
 */
export const parsearResourceName = (resourceName: string): IRecurso|undefined => {
    if (!resourceName.startsWith(PREFIJO_BUCKET)) {
        return undefined;
    }

    const separador = resourceName.indexOf(SEPARADOR_OBJETO, PREFIJO_BUCKET.length);
    if (separador<0) {
        return undefined;
    }

    const bucket = resourceName.substring(PREFIJO_BUCKET.length, separador);
    const path = resourceName.substring(separador + SEPARADOR_OBJETO.length);
    if (bucket.length===0 || path.length===0) {
        return undefined;
    }

    return {bucket, path};
};
