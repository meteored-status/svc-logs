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

export function getDepartmentName(department: EDepartment): string {
    return DeparmentNames.get(department) || '';
}
