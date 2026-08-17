/**
 * Editor: Bixus
 * Fecha: Thu, 13 Aug 2026 11:53:20 GMT
 * Hash: c817fbb94d6029cb23f5952d86f61e7d
 * Versión: 2026.8.13+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export enum EDepartment {
    BACKOFFICE  = 1,
    METEO       = 2,
    WEB         = 3,
    APPS        = 4,
}

const DeparmentNames: Map<EDepartment, string> = new Map<EDepartment, string>([
    [EDepartment.BACKOFFICE, 'Backoffice'],
    [EDepartment.METEO, 'Meteo'],
    [EDepartment.WEB, 'Web'],
    [EDepartment.APPS, 'Apps'],
]);

/**
 * Nombre de uno de los departamentos **conocidos por código**.
 *
 * Ojo: desde que los departamentos se administran desde el panel (`/manager/dpto`), este enum ya no es
 * el catálogo completo — la tabla `department` es la fuente de la verdad y puede tener más—. Para
 * ofrecer o etiquetar departamentos hay que usar el catálogo que viaja en los payloads
 * (`IListOUT.availableDepartments` del listado de usuarios); esta función es solo para el código que
 * necesita referirse a uno concreto.
 *
 * Un id que no esté en el enum devuelve `#<id>` y no cadena vacía: en la UI un hueco en blanco no se
 * distingue de un fallo de carga.
 */
export function getDepartmentName(department: EDepartment): string {
    return DeparmentNames.get(department) ?? `#${department}`;
}
