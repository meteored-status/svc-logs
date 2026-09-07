/**
 * Editor: Bixus
 * Fecha: Fri, 04 Sep 2026 11:24:52 GMT
 * Hash: 59617fe875e7ceab16fe6fb53e2d518b
 * Versión: 2026.9.4+2-bixus
 * Anterior: 2026.9.4+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, type RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {auditRequest} from "../audit/request";
import {EService, SERVICES} from "../../config";
import type {IDeleteIN} from "./delete/interface";
import type {IDeviceDeleteIN, IDeviceIN, IDevicesOUT, IDeviceTestOUT} from "./device/interface";
import type {ILangIN} from "./lang/interface";
import type {IPreferenciasIN, IPreferenciasOUT} from "./notification/interface";
import type {IListOUT} from "./list/interface";
import type {ISaveIN} from "./save/interface";

export class User extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async list(token: string): Promise<RequestResponse<IListOUT>> {
        return this.get<IListOUT>(`${this.SERVICIO}/backend/user/list`, {auth: token});
    }

    /**
     * Cambia el idioma **del propio usuario**.
     *
     * Endpoint aparte de `save()` y no un campo más suyo, porque los dos permisos no tienen nada que ver: `save()`
     * pide `status.user.edit`, que es administrar a **otros**, y esto solo pide tener sesión. Metido dentro de
     * `save()`, cambiar tu propio idioma habría exigido permiso de administración de usuarios.
     *
     * Con `auditRequest`, como todas las escrituras.
     */
    @logRejection(true)
    public static async lang(token: string, data: ILangIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ILangIN>(`${this.SERVICIO}/backend/user/lang`, data, auditRequest(token, auditPath));
    }

    /**
     * Qué avisos recibe **el propio usuario** y por qué canal.
     *
     * Sin `auditRequest`, como el resto de las lecturas: lo pide la pantalla de Mi cuenta cada vez que se abre.
     */
    @logRejection(true)
    public static async notifications(token: string): Promise<RequestResponse<IPreferenciasOUT>> {
        return this.get<IPreferenciasOUT>(`${this.SERVICIO}/backend/user/notification`, {auth: token});
    }

    /**
     * Guarda qué avisos recibe **el propio usuario** y por qué canal.
     *
     * Va con la sesión y sin permiso, igual que `lang()` y por lo mismo: no hay forma de expresar «cambia lo
     * que recibe otro». Y **con `auditRequest`**, que aquí importa más que en el idioma: quien deja de recibir
     * los avisos de un monitor caído no lo nota, y lo que hay que poder contestar meses después es cuándo
     * dejó de llegarle y quién lo cambió.
     */
    @logRejection(true)
    public static async notificationsSave(token: string, data: IPreferenciasIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IPreferenciasIN>(`${this.SERVICIO}/backend/user/notification/save`, data, auditRequest(token, auditPath));
    }

    /**
     * Los dispositivos que **el propio usuario** tiene registrados para notificaciones.
     *
     * `propio` es el token de quien pregunta, para que la lista pueda marcar cuál es este navegador. Viaja en
     * la query y no en el cuerpo porque es una lectura; y es opcional, porque quien no ha dado permiso a las
     * notificaciones no tiene ninguno.
     */
    @logRejection(true)
    public static async devices(token: string, propio?: string): Promise<RequestResponse<IDevicesOUT>> {
        const query = propio !== undefined && propio.length > 0 ? `?propio=${encodeURIComponent(propio)}` : "";

        return this.get<IDevicesOUT>(`${this.SERVICIO}/backend/user/device${query}`, {auth: token});
    }

    /**
     * Registra o refresca un dispositivo de **el propio usuario**.
     *
     * **Sin `auditRequest`, y es la excepción entre las escrituras.** Lo llama el panel en cada arranque para
     * refrescar el token, así que auditarlo llenaría el registro de un apunte por cada carga de página de cada
     * persona — exactamente lo que se decidió no hacer con las lecturas. Lo que sí se audita es cambiar las
     * preferencias, que es la decisión; esto es el mecanismo.
     */
    @logRejection(true)
    public static async deviceSave(token: string, data: IDeviceIN): Promise<RequestResponse<{}>> {
        return this.post<{}, IDeviceIN>(`${this.SERVICIO}/backend/user/device/save`, data, {auth: token});
    }

    /**
     * Da de baja un dispositivo de **el propio usuario**.
     *
     * Esto **sí** se audita: es una acción deliberada, y dejar de recibir avisos en un dispositivo es del tipo
     * de cosas que meses después alguien quiere poder fechar.
     */
    @logRejection(true)
    public static async deviceDelete(token: string, data: IDeviceDeleteIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IDeviceDeleteIN>(`${this.SERVICIO}/backend/user/device/delete`, data, auditRequest(token, auditPath));
    }

    /**
     * Manda una notificación de prueba a **todos** los dispositivos del propio usuario.
     *
     * A todos y no solo a este navegador, que es lo que la hace útil: lo que no se sabe es si llega al móvil
     * que no tienes delante. El que está delante ya se comprueba solo con activarlo.
     *
     * Sin cuerpo —no hay nada que elegir— pero **POST**, porque manda algo a un sitio: un GET que despierta
     * dos teléfonos lo repetiría cualquier precarga del navegador.
     *
     * Se audita como `CHECK`: no cambia ninguna preferencia, pero es la explicación de una notificación
     * aparecida a deshora, y eso es exactamente lo que se busca en el registro meses después.
     */
    @logRejection(true)
    public static async deviceTest(token: string, auditPath: string): Promise<RequestResponse<IDeviceTestOUT>> {
        return this.post<IDeviceTestOUT, {}>(`${this.SERVICIO}/backend/user/device/test`, {}, auditRequest(token, auditPath));
    }

    @logRejection(true)
    public static async save(token: string, data: ISaveIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ISaveIN>(`${this.SERVICIO}/backend/user/save`, data, auditRequest(token, auditPath));
    }

    // `remove` y no `delete`: `BackendRequest` ya tiene un estático `delete` (el verbo HTTP) y
    // sobrescribirlo con otra firma rompe la clase. Mismo criterio que el cliente de
    // `logs/logs/errores`.
    @logRejection(true)
    public static async remove(token: string, data: IDeleteIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IDeleteIN>(`${this.SERVICIO}/backend/user/delete`, data, auditRequest(token, auditPath));
    }
}
