/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 10e7ea88b78281cd7c271d7b3aa4d93b
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.8.26+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {RequestResponse} from "services-comun/modules/net/request-backend";
import {BackendRequest} from "services-comun/modules/net/request-backend";

import {EService, SERVICES} from "../../config";
import type {IImpersonateEndIN, IImpersonateIN} from "./impersonate/interface";
import type {ILoginIN, ILoginOUT} from "./login/interface";
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
