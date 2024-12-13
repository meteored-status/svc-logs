import {RouteGroup} from "services-comun/modules/net/routes/group";
import {Configuracion} from "../../utiles/config";
import {IRouteGroup} from "services-comun/modules/net/routes/group/block";
import {Conexion} from "services-comun/modules/net/conexion";
import {error} from "services-comun/modules/utiles/log";
import {LogServicio} from "../../data/log/log-servicio";
import {IListIN, IListOUT} from "services-comun-status/modules/services/logs/logs/servicios/list/interface";
import {
    IAvaliableFiltersIN,
    IAvaliableFiltersOUT
} from "services-comun-status/modules/services/logs/logs/servicios/available-filters/interface";
import {
    IDeleteIN,
    IDeleteOUT
} from "services-comun-status/modules/services/logs/logs/servicios/delete/interface";

class Servicio extends RouteGroup<Configuracion> {
    /* STATIC */

    /* INSTANCE */
    private async handleList(conexion: Conexion): Promise<number> {
        try {
            const query: IListIN = conexion.getQuery<IListIN>();

            if (!query.projects) {
                return conexion.error(400, 'Bad Request');
            }

            const projects = query.projects.split(';');
            let page = undefined;
            if (query.page) {
                page = parseInt(query.page);
            }
            let perPage = undefined;
            if (query.perPage) {
                perPage = parseInt(query.perPage);
            }

            const severity = query.severity;
            const services = query.services?.split(';');
            const types = query.types?.split(';');

            let ts_from = undefined;
            if (query.ts_from) {
                ts_from = parseInt(query.ts_from);
            }

            let ts_to = undefined;
            if (query.ts_to) {
                ts_to = parseInt(query.ts_to);
            }

            const logs = await LogServicio.search({
                projects,
                severidad: severity,
                servicios: services,
                tipos: types,
                ts_from,
                ts_to
            }, {
                page,
                perPage
            });

            return this.sendRespuesta<IListOUT>(conexion, {
                data: {
                    logs: logs.map(log => {
                        return {
                            timestamp: log.timestamp.getTime(),
                            project: log.proyecto,
                            message: log.mensaje,
                            service: log.servicio,
                            type: log.tipo,
                            severity: parseInt(log.severidad),
                    }}),
                }
            });
        } catch (e) {
            error('Logs.handleList', e);
            return conexion.error(500, 'Internal Server Error');
        }
    }

    private async handleAvailableFilters(conexion: Conexion): Promise<number> {
        try {
            const query: IAvaliableFiltersIN = conexion.getQuery<IAvaliableFiltersIN>();

            if (!query.projects) {
                return conexion.error(400, 'Bad Request');
            }

            const filtros = await LogServicio.filterValues(query.projects.split(';'));

            return this.sendRespuesta<IAvaliableFiltersOUT>(conexion, {
                data: {
                    services: filtros.servicio,
                    types: filtros.tipo
                }
            });
        } catch (e) {
            error('Logs.handleAvailableFilters', e);
            return conexion.error(500, 'Internal Server Error');
        }
    }

    private async handleDelete(conexion: Conexion): Promise<number> {
        try {
            const post: IDeleteIN = conexion.post as IDeleteIN;

            if (!post.projects || !post.action || (
                !post.action.timestamp &&
                !post.action.severities?.length &&
                !post.action.services?.length &&
                !post.action.types?.length &&
                !post.action.messages?.length
            )) {
                return conexion.error(400, 'Bad Request');
            }

            await LogServicio.delete({
                projects: post.projects,
                timestamp: post.action.timestamp,
                severidades: post.action.severities,
                servicios: post.action.services,
                tipos: post.action.types,
                mensajes: post.action.messages
            });

            return this.sendRespuesta<IDeleteOUT>(conexion, {
                data: {}
            });
        } catch (e) {
            error('Logs.handleDelete', e);
            return conexion.error(500, 'Internal Server Error');
        }
    }

    protected override getHandlers(): IRouteGroup[] {
        return [
            {
                expresiones: [
                    {
                        metodos: ['GET'],
                        exact: '/private/logs/servicio/list/',
                        resumen: '/private/logs/servicio/list/',
                        internal: true,
                        query: {
                            projects: {
                                regex: /[a-z]+(?:(?:;[a-z]+)?)+/
                            },
                            page: {
                                regex: /\d+/,
                                opcional: true
                            },
                            perPage: {
                                regex: /\d+/,
                                opcional: true
                            },
                            severity: {
                                regex: /[0123]/,
                                opcional: true
                            },
                            services: {
                                regex: /\w+(?:(?:;\w+)?)+/,
                                opcional: true
                            },
                            types: {
                                regex: /\w+(?:(?:;\w+)?)+/,
                                opcional: true
                            },
                            ts_from: {
                                regex: /\d+/,
                                opcional: true
                            },
                            ts_to: {
                                regex: /\d+/,
                                opcional: true
                            }
                        }
                    }
                ],
                handler: async (conexion) => {

                    return await this.handleList(conexion);
                }
            },
            {
                expresiones: [
                    {
                        metodos: ['GET'],
                        exact: '/private/logs/servicio/available-filters/',
                        resumen: '/private/logs/servicio/available-filters/',
                        internal: true,
                        query: {
                            projects: {
                                regex: /[a-z]+(?:(?:;[a-z]+)?)+/
                            }
                        }
                    }
                ],
                handler: async (conexion) => {
                    return await this.handleAvailableFilters(conexion);
                }
            },
            {
                expresiones: [
                    {
                        metodos: ['POST'],
                        exact: '/private/logs/servicio/delete/',
                        resumen: '/private/logs/servicio/delete/',
                        internal: true,
                    }
                ],
                handler: async (conexion) => {
                    return await this.handleDelete(conexion);
                }
            }
        ];
    }
}

let instance: Servicio|null = null;
export default (config: Configuracion) => instance??= new Servicio(config);
