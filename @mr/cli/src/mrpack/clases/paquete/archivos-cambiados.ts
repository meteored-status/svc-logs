/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 353ce42ae20a830807c295f1a98c417d
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

/**
 * Modelo y combinación de listas de ficheros cambiados de un `Paquete`, usados por el
 * gestor de frameworks para mostrar el estado de cambios locales/remotos y su diff.
 */

/**
 * Estado de un fichero en el listado de cambios del gestor de frameworks.
 *
 * - `Cambiado`  — el fichero existe en ambos lados pero con contenido diferente.
 * - `Nuevo`     — el fichero no existía antes (creado localmente o traído por el remoto).
 * - `Eliminado` — el fichero ha sido borrado.
 */
export const enum EstadoArchivo {
    Cambiado  = "cambiado",
    Nuevo     = "nuevo",
    Eliminado = "eliminado",
}

/**
 * Origen del cambio de un fichero en el listado combinado.
 *
 * - `Local`  — solo hay cambio en el lado local.
 * - `Remoto` — solo hay cambio en el lado remoto.
 * - `Ambos`  — hay cambio en los dos lados simultáneamente.
 */
export const enum OrigenArchivo {
    Local  = "local",
    Remoto = "remoto",
    Ambos  = "ambos",
}

/**
 * Fichero con estado de cambio para la vista de diff del gestor de frameworks.
 *
 * @property archivo   - Ruta relativa al directorio raíz del paquete.
 * @property estado    - Estado del fichero (`EstadoArchivo`).
 * @property origen    - Origen del cambio (`OrigenArchivo`).
 * @property conflicto - `true` cuando `origen === Ambos` y los estados son contradictorios (uno crea y el otro borra el mismo fichero).
 */
export interface IArchivoCambiado {
    archivo: string;
    estado: EstadoArchivo;
    origen: OrigenArchivo;
    conflicto?: boolean;
}

const ORDEN_ORIGEN: Record<string, number> = {
    [OrigenArchivo.Ambos]:  0,
    [OrigenArchivo.Local]:  1,
    [OrigenArchivo.Remoto]: 2,
};

/**
 * Devuelve la lista combinada de ficheros con cambios locales Y remotos para el caso
 * en que un framework tiene ambos pendientes a la vez. Cada fichero indica su origen:
 * `"local"` si solo hay cambio local, `"remoto"` si solo remoto, `"ambos"` si hay cambio en los dos.
 * Los ficheros con `"ambos"` aparecen primero, luego los locales, luego los remotos.
 *
 * @param locales - Ficheros con cambios locales, o `null` si no se pudo calcular.
 * @param remotos - Ficheros con cambios remotos, o `null` si no se pudo calcular.
 * @returns Lista combinada de `IArchivoCambiado`, o `null` si ambos parámetros son `null`.
 */
export function combinarArchivosCambiados(locales: IArchivoCambiado[] | null, remotos: IArchivoCambiado[] | null): IArchivoCambiado[] | null {
    if (locales === null && remotos === null) {
        return null;
    }
    const localMap  = new Map((locales  ?? []).map(a => [a.archivo, a]));
    const remotoMap = new Map((remotos  ?? []).map(a => [a.archivo, a]));
    const resultado: IArchivoCambiado[] = [];
    for (const [archivo, item] of localMap) {
        const remotoItem = remotoMap.get(archivo);
        if (remotoItem !== undefined) {
            // Caso: local crea un fichero nuevo y remote no lo tiene → falso conflicto.
            // El update no borra ficheros locales que no estaban en el ZIP base, así que
            // este fichero simplemente no es conocido por el remoto. Mostrarlo como local-only.
            if (item.estado === EstadoArchivo.Nuevo && remotoItem.estado === EstadoArchivo.Eliminado) {
                resultado.push({...item, origen: OrigenArchivo.Local});
                continue;
            }
            // Caso: ambos lados lo eliminaron → no hay diff que ver.
            if (item.estado === EstadoArchivo.Eliminado && remotoItem.estado === EstadoArchivo.Eliminado) {
                resultado.push({archivo, estado: EstadoArchivo.Eliminado, origen: OrigenArchivo.Ambos});
                continue;
            }
            // Caso conflicto real:
            //   1) El usuario lo borró y el remoto lo trae.
            //   2) Ambos crearon el mismo fichero nuevo de forma independiente con distinto contenido
            //      (si fueran iguales, el fichero no aparecería en la lista remota).
            const conflicto = (item.estado === EstadoArchivo.Eliminado && remotoItem.estado === EstadoArchivo.Nuevo)
                || (item.estado === EstadoArchivo.Nuevo && remotoItem.estado === EstadoArchivo.Cambiado);
            resultado.push({archivo, estado: EstadoArchivo.Cambiado, origen: OrigenArchivo.Ambos, conflicto: conflicto || undefined});
        } else {
            resultado.push({...item, origen: OrigenArchivo.Local});
        }
    }
    for (const [archivo, item] of remotoMap) {
        if (!localMap.has(archivo)) {
            resultado.push({...item, origen: OrigenArchivo.Remoto});
        }
    }
    resultado.sort((a, b) => ORDEN_ORIGEN[a.origen] - ORDEN_ORIGEN[b.origen] || a.archivo.localeCompare(b.archivo));
    return resultado;
}
