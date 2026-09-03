/**
 * Editor: Bixus
 * Fecha: Wed, 26 Aug 2026 09:06:22 GMT
 * Hash: ac9494a0e3c94f2eec14293aa2493cb9
 * Versión: 2026.8.26+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {EService, SERVICES} from "../../config";
import {IImpersonateEndIN, IImpersonateIN} from "./impersonate/interface";
import {ILoginIN, ILoginOUT} from "./login/interface";

import {auditRequest} from "../audit/request";

export class Auth extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    public static async login(token: string, data: ILoginIN): Promise<RequestResponse<ILoginOUT>> {
        return this.post<ILoginOUT, ILoginIN>(`${this.SERVICIO}/backend/auth/login`, data, {auth: token});
    }

    /**
     * Arranca una suplantación. Se llama **como uno mismo** —sin la marca puesta— y su único efecto en el
     * servidor es dejar el apunte de auditoría: quién ha empezado a ver el panel como quién. De ahí que vaya con
     * `auditRequest` y no con `{auth}` a secas.
     */
    public static async impersonate(token: string, data: IImpersonateIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IImpersonateIN>(`${this.SERVICIO}/backend/auth/impersonate`, data, auditRequest(token, auditPath));
    }

    /**
     * Cierra el apunte de una suplantación. Se manda **como uno mismo**, con la marca ya quitada: con ella
     * puesta lo rechazaría el solo lectura.
     */
    public static async impersonateEnd(token: string, data: IImpersonateEndIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IImpersonateEndIN>(`${this.SERVICIO}/backend/auth/impersonate/end`, data, auditRequest(token, auditPath));
    }
}
