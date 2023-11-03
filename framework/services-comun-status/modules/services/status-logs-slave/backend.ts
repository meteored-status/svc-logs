// import {stringify} from "qs";
//
// import {BackendRequest} from "services-comun/modules/net/request-backend";
// import {RequestResponse} from "services-comun/modules/net/request";
// import {logRejection} from "services-comun/modules/decorators/metodo";
//
// import {EService, SERVICES} from "../config";
//
// export interface ICliente {
//     id: string;
//     grupo?: string;
// }
//
// export class SlaveLogsBackendRequest extends BackendRequest {
//     /* STATIC */
//     private static SERVICIO: string = SERVICES.servicio(EService.status_logs_slave).base;
//
//     @logRejection(true)
//     public static async ingest(bucket: string, archivo: string, cliente?: string, grupo?: string): Promise<RequestResponse<void>> {
//         const params = stringify({
//             bucket,
//             archivo,
//             cliente,
//             grupo,
//         });
//         return this.get<void>(`${this.SERVICIO}/private/logs/ingest/?${params}`);
//     }
//
//     /* INSTANCE */
// }
