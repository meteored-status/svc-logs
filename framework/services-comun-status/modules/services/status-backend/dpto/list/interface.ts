/**
 * Editor: Bixus
 * Fecha: Thu, 13 Aug 2026 11:53:20 GMT
 * Hash: c10f31a3cc21657adc5ab863b1b48974
 * Versión: 2026.8.13+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EUserStatus} from "../../user/interface";

/**
 * Listado de departamentos del panel.
 *
 * @property departments    - Todos los departamentos, ordenados por nombre.
 * @property memberCount    - Usuarios **distintos** con al menos un departamento. No es la suma de los
 *                            `IDpto.userCount`: quien pertenece a dos departamentos cuenta una vez aquí y
 *                            dos en esa suma. Se calcula en el servidor (`count(distinct user)`) y no en
 *                            el cliente a partir de `IDpto.users`, porque esa lista viaja vacía sin
 *                            `status.user.list` — la cifra saldría distinta según el permiso de quien
 *                            pregunte, que en un resumen es peor que una etiqueta imprecisa.
 * @property availableUsers - Padrón completo de usuarios, para poder asignarlos a un departamento sin
 *                            una segunda petición. Llega **vacío** si quien pide el listado no tiene
 *                            `status.user.list`, igual que `IDpto.users`: esto es el listado de
 *                            usuarios, y no lo abre el permiso de departamentos. Ojo al pintarlo: vacío
 *                            no significa «no hay usuarios», significa «no hay o no puedes verlos».
 */
export interface IListOUT {
    departments: IDpto[];
    memberCount: number;
    availableUsers: IDptoUser[];
}

/**
 * Departamento del panel.
 *
 * @property id           - Identificador del departamento. Coincide con `EDepartment` para los cuatro
 *                          que vienen de la semilla; los creados desde el panel no están en ese enum.
 * @property name         - Nombre visible, único por departamento.
 * @property indexService - Id base de los servicios del departamento: un servicio nuevo se numera a
 *                          partir de aquí (`index_service + 1`, ver `Service.save()`). Por eso los de
 *                          la semilla van espaciados de mil en mil, y por eso no se cambia una vez
 *                          creado: los servicios que ya tenga están numerados en el rango viejo.
 * @property users        - Miembros del departamento, ordenados por nombre. Llega **vacía** si quien
 *                          pide el listado no tiene `status.user.list`: saber quiénes son es ver el
 *                          padrón, y eso no lo abre el permiso de departamentos.
 * @property userCount    - Cuántos miembros tiene. **Va siempre**, con permiso o sin él: es
 *                          información del departamento, y de ella depende si se puede borrar.
 *
 *                          Ojo: `users.length` **no** es el número de miembros — sin
 *                          `status.user.list` la lista viene vacía y la cifra sigue siendo correcta.
 * @property serviceCount - Cuántos servicios cuelgan del departamento. También impide borrarlo, por la
 *                          clave ajena `fk_service_department`.
 */
export interface IDpto {
    id: number;
    name: string;
    indexService: number;
    users: IDptoUser[];
    userCount: number;
    serviceCount: number;
}

/**
 * Miembro de un departamento.
 *
 * Mismos campos que `IRolUser` de `rol/list`, pero cada endpoint declara su propio contrato: no
 * comparten tipo para que el día que a uno le haga falta un campo más no se lo lleve el otro por
 * delante.
 *
 * @property id     - Identificador interno del usuario.
 * @property name   - Nombre visible.
 * @property email  - Email, único por usuario.
 * @property status - Estado de la cuenta (`EUserStatus`): un miembro pendiente o vetado sigue contando
 *                    como miembro, pero no puede entrar al panel.
 */
export interface IDptoUser {
    id: number;
    name: string;
    email: string;
    status: EUserStatus;
}
