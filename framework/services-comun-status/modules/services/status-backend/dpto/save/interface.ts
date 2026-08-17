/**
 * Editor: Bixus
 * Fecha: Thu, 13 Aug 2026 11:53:20 GMT
 * Hash: 2f510296849f6b6f25f7f2e3df9a12ae
 * Versión: 2026.8.13+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Cambios a guardar en un departamento, o los datos de uno nuevo.
 *
 * @property id          - Identificador del departamento a modificar. **Ausente da de alta uno nuevo**,
 *                         y MySQL le asigna el id (`department.id` es auto_increment desde
 *                         `mapping/mysql/ddl-alter-0011.sql`). Mismo criterio que `ISaveIN` de rol.
 * @property name        - Nombre visible. Es **único** en la tabla (`uq_department_name`), así que un
 *                         nombre repetido se rechaza.
 * @property indexService - Id base de los servicios del departamento. **Solo se aplica al dar de
 *                         alta**: no se puede cambiar después, porque los servicios que ya tenga están
 *                         numerados a partir del valor viejo y moverlo los dejaría fuera de su rango.
 *                         Al editar hay que mandar el que ya tiene o se rechaza la petición. Si se
 *                         omite en un alta, el backend elige el siguiente hueco.
 * @property users       - Miembros del departamento. La lista llega completa y sustituye a la anterior.
 *                         **Omitirla deja las asignaciones como están**, que es lo que hay que hacer si
 *                         no se quieren tocar: mandarla vacía saca a todo el mundo. Cambiarlas exige
 *                         `status.user.list` y `status.user.edit` **además** de `status.dpto.edit`,
 *                         igual que en los roles: es el mismo permiso que pide asignar departamentos
 *                         desde la ficha del usuario, y la lista sustituye, así que sin poder verla se
 *                         reescribiría a ciegas lo que hay.
 */
export interface ISaveIN {
    id?: number;
    name: string;
    indexService?: number;
    users?: number[];
}
