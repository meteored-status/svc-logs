import {FrontendRequest} from "services-comun/modules/net/request-frontend";
import {RequestResponse} from "services-comun/modules/net/request";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {IPostLogin} from "./interface";
import dominio, {EDominio} from "../../portal/dominio";
import {IUsuarioResponse, Usuario} from "./usuario";

export class StatusAuthFrontendRequest extends FrontendRequest {
    /* STATIC */
    private static SERVICIO: string = dominio.get(EDominio.status);

    @logRejection(true)
    public static async login(auth: string, post: IPostLogin): Promise<RequestResponse<Usuario>> {
        const data = await this.postJSON<IUsuarioResponse, IPostLogin>(`${this.SERVICIO}/web/login/`, post, {auth});
        return {
            ...data,
            data: Usuario.build(data.data),
        };
    }

    /* INSTANCE */
}
