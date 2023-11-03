// import {BackendRequest} from "services-comun/modules/net/request-backend";
// import {IExpresionDynamic} from "services-comun/modules/net/checkers/checker";
// import {logRejection} from "services-comun/modules/decorators/metodo";
//
// import {EService, SERVICES} from "../config";
//
//
// export class CompeticionesWebBackendRequest extends BackendRequest {
//     /* STATIC */
//     private static SERVICIO: string = SERVICES.servicio(EService.status_auth).base;
//
//
//     @logRejection(true)
//     public static async permissions(): Promise<IExpresionDynamic<IResultadosRouter>[]> {
//         return this.get<IExpresionDynamic<IResultadosRouter>[]>(`${this.SERVICIO}/private/status/auth/permissions/`);
//     }
//
//     /* INSTANCE */
// }
