/**
 * Editor: Bixus
 * Fecha: Mon, 31 Aug 2026 06:46:28 GMT
 * Hash: ac925c64be2f2b7911d598397a03f09b
 * Versión: 2026.8.31+1-bixus
 * Anterior: 2026.8.26+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {auditRequest} from "../audit/request";
import {EService, SERVICES} from "../../config";
import {IHolidayDeleteIN, IHolidayExcludeIN, IHolidayIN, IHolidayRestoreIN} from "./holiday/interface";
import {IHolidaysOUT} from "./holidays/interface";
import {IListOUT} from "./list/interface";
import {IMatesOUT} from "./mates/interface";
import {IMineOUT} from "./mine/interface";
import {IOrderIN} from "./order/interface";
import {IRequestActionIN, IRequestIN, IRequestTokenIN, IRequestTokenOUT} from "./request/interface";
import {IOverrideDeleteIN, IOverrideIN} from "./override/interface";
import {IResetIN} from "./reset/interface";
import {IRosterIN} from "./roster/interface";
import {ISkipDeleteIN, ISkipIN} from "./skip/interface";
import {ISwapDeleteIN, ISwapIN} from "./swap/interface";
import {ITodayOUT} from "./today/interface";

export class OnCall extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    /**
     * Quién está de guardia hoy. Sin `auditRequest`, al contrario que las escrituras: lo pide el layout en
     * cada carga del panel, así que auditarlo llenaría el registro de accesos con una entrada por página
     * vista y no diría nada que la propia auditoría de accesos no diga ya.
     */
    @logRejection(true)
    public static async today(token: string): Promise<RequestResponse<ITodayOUT>> {
        return this.get<ITodayOUT>(`${this.SERVICIO}/backend/oncall/today`, {auth: token});
    }

    @logRejection(true)
    public static async list(token: string): Promise<RequestResponse<IListOUT>> {
        return this.get<IListOUT>(`${this.SERVICIO}/backend/oncall/list`, {auth: token});
    }

    /**
     * La guardia de quien pregunta. Sin `auditRequest` y por lo mismo que `today()`: es una lectura de sus
     * propios datos que se hace al abrir su ficha, y auditarla llenaría el registro de accesos sin decir nada
     * que la auditoría de accesos no diga ya.
     */
    @logRejection(true)
    public static async mine(token: string): Promise<RequestResponse<IMineOUT>> {
        return this.get<IMineOUT>(`${this.SERVICIO}/backend/oncall/mine`, {auth: token});
    }

    /**
     * Los festivos registrados, con a quién le toca cada uno de los que están por venir. Es la pantalla de
     * calendarios, y va aparte de `list()` porque son dos ventanas distintas: `list()` trae los festivos que
     * caen en las semanas que pinta la planificación y esta la serie completa, que es lo que hace falta
     * para administrarla.
     */
    @logRejection(true)
    public static async holidays(token: string): Promise<RequestResponse<IHolidaysOUT>> {
        return this.get<IHolidaysOUT>(`${this.SERVICIO}/backend/oncall/holidays`, {auth: token});
    }

    @logRejection(true)
    public static async holiday(token: string, data: IHolidayIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IHolidayIN>(`${this.SERVICIO}/backend/oncall/holiday`, data, auditRequest(token, auditPath));
    }

    /**
     * Los tramos de los compañeros de rueda, para el diálogo de solicitud. Se pide al abrirlo y no con la ficha:
     * calcular el reparto de toda la rueda en cada visita al perfil sería pagarlo para no usarlo.
     */
    @logRejection(true)
    public static async mates(token: string): Promise<RequestResponse<IMatesOUT>> {
        return this.get<IMatesOUT>(`${this.SERVICIO}/backend/oncall/mates`, {auth: token});
    }

    /**
     * Pedir un cambio de guardia, y responder a los que te piden. Las tres **sí** se auditan, al contrario que
     * las lecturas: son escrituras, y además son las únicas que tocan el reparto sin `status.oncall.edit`, así
     * que el registro es lo que permite saber después quién acordó qué con quién.
     */
    @logRejection(true)
    public static async request(token: string, data: IRequestIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IRequestIN>(`${this.SERVICIO}/backend/oncall/request`, data, auditRequest(token, auditPath));
    }

    @logRejection(true)
    public static async requestAccept(token: string, data: IRequestActionIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IRequestActionIN>(`${this.SERVICIO}/backend/oncall/request/accept`, data, auditRequest(token, auditPath));
    }

    @logRejection(true)
    public static async requestDelete(token: string, data: IRequestActionIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IRequestActionIN>(`${this.SERVICIO}/backend/oncall/request/delete`, data, auditRequest(token, auditPath));
    }

    /**
     * Las tres del enlace del correo, y las **únicas de este cliente sin token de sesión**: quien las llama no
     * ha entrado al panel, solo ha abierto un enlace. Lo que autoriza es el UUID de la solicitud, que va en el
     * cuerpo.
     *
     * Tampoco llevan la pantalla de auditoría, y no es un olvido: no hubo pantalla del panel. El apunte de
     * aceptar o rechazar lo escribe el backend igual, con el endpoint como ruta, que es exactamente lo que hay
     * que poder leer después — «esto no se hizo desde el panel».
     *
     * `requestToken` es una **lectura** y por eso va por `POST`: es lo único de aquí que no escribe nada, pero
     * un `GET` obligaría a poner el token en la URL, y ahí acabaría en los logs de acceso de todo el camino.
     */
    @logRejection(true)
    public static async requestToken(data: IRequestTokenIN): Promise<RequestResponse<IRequestTokenOUT>> {
        return this.post<IRequestTokenOUT, IRequestTokenIN>(`${this.SERVICIO}/backend/oncall/request/token`, data);
    }

    @logRejection(true)
    public static async requestTokenAccept(data: IRequestTokenIN): Promise<RequestResponse<{}>> {
        return this.post<{}, IRequestTokenIN>(`${this.SERVICIO}/backend/oncall/request/token/accept`, data);
    }

    @logRejection(true)
    public static async requestTokenReject(data: IRequestTokenIN): Promise<RequestResponse<{}>> {
        return this.post<{}, IRequestTokenIN>(`${this.SERVICIO}/backend/oncall/request/token/reject`, data);
    }

    @logRejection(true)
    public static async order(token: string, data: IOrderIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IOrderIN>(`${this.SERVICIO}/backend/oncall/order`, data, auditRequest(token, auditPath));
    }

    @logRejection(true)
    public static async roster(token: string, data: IRosterIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IRosterIN>(`${this.SERVICIO}/backend/oncall/roster`, data, auditRequest(token, auditPath));
    }

    @logRejection(true)
    public static async override(token: string, data: IOverrideIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IOverrideIN>(`${this.SERVICIO}/backend/oncall/override`, data, auditRequest(token, auditPath));
    }

    @logRejection(true)
    public static async skip(token: string, data: ISkipIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ISkipIN>(`${this.SERVICIO}/backend/oncall/skip`, data, auditRequest(token, auditPath));
    }

    @logRejection(true)
    public static async skipRemove(token: string, data: ISkipDeleteIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ISkipDeleteIN>(`${this.SERVICIO}/backend/oncall/skip/delete`, data, auditRequest(token, auditPath));
    }

    @logRejection(true)
    public static async swap(token: string, data: ISwapIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ISwapIN>(`${this.SERVICIO}/backend/oncall/swap`, data, auditRequest(token, auditPath));
    }

    /**
     * Deshace un cambio de guardia entero. `swapRemove` y no `swapDelete`, con el mismo criterio que
     * `overrideRemove`: los borrados de esta capa no se llaman `delete`.
     */
    @logRejection(true)
    public static async swapRemove(token: string, data: ISwapDeleteIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ISwapDeleteIN>(`${this.SERVICIO}/backend/oncall/swap/delete`, data, auditRequest(token, auditPath));
    }

    @logRejection(true)
    public static async reset(token: string, data: IResetIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IResetIN>(`${this.SERVICIO}/backend/oncall/reset`, data, auditRequest(token, auditPath));
    }

    // `overrideRemove` y no `overrideDelete`: `BackendRequest` ya tiene un estático `delete` (el verbo
    // HTTP), y aunque aquí el nombre no colisione, el criterio es el mismo que en `User.remove()` y en el
    // cliente de logs — que los borrados de esta capa no se llamen `delete`.
    @logRejection(true)
    public static async overrideRemove(token: string, data: IOverrideDeleteIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IOverrideDeleteIN>(`${this.SERVICIO}/backend/oncall/override/delete`, data, auditRequest(token, auditPath));
    }

    @logRejection(true)
    public static async holidayRemove(token: string, data: IHolidayDeleteIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IHolidayDeleteIN>(`${this.SERVICIO}/backend/oncall/holiday/delete`, data, auditRequest(token, auditPath));
    }

    /**
     * Descarta un día del feed —el que trae de más cuando un festivo se traslada— y lo recupera. Van aparte de
     * `holiday()` y `holidayRemove()` porque son otra cosa: esos gestionan los festivos **manuales** y estos
     * gobiernan lo que la importación se salta.
     */
    @logRejection(true)
    public static async holidayExclude(token: string, data: IHolidayExcludeIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IHolidayExcludeIN>(`${this.SERVICIO}/backend/oncall/holiday/exclude`, data, auditRequest(token, auditPath));
    }

    @logRejection(true)
    public static async holidayRestore(token: string, data: IHolidayRestoreIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IHolidayRestoreIN>(`${this.SERVICIO}/backend/oncall/holiday/exclude/delete`, data, auditRequest(token, auditPath));
    }
}
