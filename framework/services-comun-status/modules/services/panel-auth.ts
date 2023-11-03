// import got from "got";
// import {IRespuesta} from "services-comun/modules/net/interface";
// import {Conexion} from "services-comun/modules/net/conexion";
//
// import {EService, SERVICES} from "./config";
// import {IUsuarioSimple} from "./panel-usuarios/interface";
// import {error} from "services-comun/modules/utiles/log";
//
// export class PanelAuth {
//     public static AUTH_BASE = SERVICES.servicio(EService.panel_auth).base;
//
//     // @ts-ignore
//     public static async checkPermisos(conexion: Conexion, permisos: (string[]|string)[]) : Promise<void> {
//         const authorization = conexion.getHeaders().authorization;
//         if (authorization==undefined) {
//             return Promise.reject('No tiene permiso para realizar la acción solicitada');
//         }
//
//         const permisosCorregidos = permisos.map(x => Array.isArray(x) ? x : [x]);
//
//         try {
//             const result = await got.post(`${this.AUTH_BASE}/private/backoffice/auth/permisos/`, {
//                 headers: {
//                     authorization,
//                 },
//                 json: permisosCorregidos,
//             }).json<IRespuesta<void>>();
//             if (!result.ok) {
//                 return Promise.reject(result.info?.message ?? "Sin permisos");
//             }
//         } catch (e) {
//             error("Sin permisos", `${this.AUTH_BASE}/private/backoffice/auth/permisos/`, e);
//             return Promise.reject("Sin permisos");
//         }
//     }
//
//     public static async getUsuario(conexion: Conexion) : Promise<IUsuarioSimple> {
//         const authorization = conexion.getHeaders().authorization;
//         if (authorization==undefined) {
//             return Promise.reject('No tiene permiso para realizar la acción solicitada');
//         }
//
//         const result = await got(`${this.AUTH_BASE}/private/backoffice/auth/usuario/`, {
//             headers: {
//                 authorization,
//             },
//         } ).json<IRespuesta<IUsuarioSimple>>();
//
//         if (result.ok && result.data) {
//             return result.data;
//         }
//
//         return Promise.reject(result.info?.message??"Sin permisos");
//
//     }
//
// }
