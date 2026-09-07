/**
 * Editor: Bixus
 * Fecha: Fri, 04 Sep 2026 13:29:00 GMT
 * Hash: 45332b8491d6b8c3c6735a6614d4f526
 * Versión: 2026.9.4+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Un nodo del árbol de ocupación que publica un disco.
 *
 * La raíz es el disco entero y cada `detail` reparte lo que ocupa entre sus carpetas. El árbol puede tener
 * la profundidad que quiera el emisor: se recorre entero, y una rama sin `detail` es una hoja.
 *
 * **La clave del objeto en `detail` es la que manda para la ruta**, no este `name`. Es lo único que garantiza
 * que las rutas sean jerárquicas y no puedan contradecir al árbol que las contiene: la ruta de un nodo es la
 * de su padre más su clave. `name` se guarda como rótulo, y en la raíz es además la identidad del disco.
 *
 * @property name   - Rótulo. En la raíz, **el nombre del disco**: es lo que distingue un disco de otro y por
 *                    lo que se agrupa el histórico, así que cambiarlo empieza una serie nueva.
 * @property used   - Bytes ocupados por ese nodo, tal cual los cuente el emisor. Se guarda sin interpretar:
 *                    si el emisor da el total del subárbol, es lo que se pinta.
 * @property detail - Reparto por carpetas, si lo hay. Ausente en una hoja.
 */
export interface IDiskNode {
    name: string;
    used: number;
    detail?: Record<string, IDiskNode>;
}

/**
 * Cuerpo de `POST /status/external/monitoring/disk/`: el árbol de un disco.
 *
 * Es el árbol tal cual, sin envoltorio, y **un disco por petición**. Con varios discos por envío, un disco
 * que fallara al escribirse dejaría la petición a medias sin poder decir cuál se guardó; separados, cada uno
 * se reintenta solo.
 *
 * @property updated - Cuándo se midió, en milisegundos. **Opcional**: si no viene se usa la hora de llegada.
 *                     Vale la pena mandarlo cuando la medida y el envío no son el mismo momento —un `du` de
 *                     un Filestore grande tarda—, porque es la fecha con la que el punto entra en la serie.
 */
export interface IPostSave extends IDiskNode {
    updated?: number;
}
