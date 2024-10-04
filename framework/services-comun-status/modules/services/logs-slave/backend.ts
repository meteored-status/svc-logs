import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {EService, SERVICES} from "../config";

export interface INotify {
    bucketId: string;
    objectId: string;
}

export class SlaveLogsBackendRequest extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.logs_slave).base;

    @logRejection(true)
    public static async ingest(bucket: string, archivo: string): Promise<RequestResponse<void>> {
        return this.post<void, INotify>(`${this.SERVICIO}/private/logs/ingest/`, {
            bucketId: bucket,
            objectId: archivo,
        });
    }

    /* INSTANCE */
}
