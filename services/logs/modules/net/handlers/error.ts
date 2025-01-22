import {RouteGroup} from "services-comun/modules/net/routes/group";
import {IRouteGroup} from "services-comun/modules/net/routes/group/block";
import {Conexion} from "services-comun/modules/net/conexion";
import {error} from "services-comun/modules/utiles/log";

import {IListIN, IListOUT} from "services-comun-status/modules/services/logs/logs/errores/list/interface";
import {
    IAvaliableFiltersIN,
    IAvaliableFiltersOUT
} from "services-comun-status/modules/services/logs/logs/errores/available-filters/interface";

import {Configuracion} from "../../utiles/config";
import {LogError} from "../../data/log/log-error";
import {IDeleteIN, IDeleteOUT} from "services-comun-status/modules/services/logs/logs/errores/delete/interface";

class Error extends RouteGroup<Configuracion> {
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

            const services = query.services?.split(';');
            const urls = query.urls?.split(';');
            const lines = query.lines?.split(';').map(line => parseInt(line));
            const files = query.files?.split(';');

            let ts_from = undefined;
            if (query.ts_from) {
                ts_from = parseInt(query.ts_from);
            }

            let ts_to = undefined;
            if (query.ts_to) {
                ts_to = parseInt(query.ts_to);
            }

            const logs = await LogError.search({
                projects,
                servicio: services,
                url: urls,
                linea: lines,
                archivo: files,
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
                            project: log.proyecto,
                            service: log.servicio,
                            timestamp: log.timestamp.getTime(),
                            url: log.url,
                            message: log.mensaje,
                            file: log.archivo,
                            line: parseInt(log.linea),
                            trace: log.traza,
                            ctx: log.ctx.map(ctx => {
                                return {
                                    line: ctx.linea,
                                    code: ctx.codigo
                                }
                            })
                        }
                    })
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

            const filtros = await LogError.filterValues(query.projects.split(';'));

            return this.sendRespuesta<IAvaliableFiltersOUT>(conexion, {
                data: {
                    services: filtros.servicio,
                    files: filtros.archivo,
                    lines: filtros.linea,
                    urls: filtros.url
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

            if (!post || !post.project?.length) {
                return conexion.error(400, 'Bad Request');
            }

            const deleted = await LogError.delete({
                proyecto: post.project,
                ts: post.ts,
                servicio: post.service,
                archivo: post.file,
                linea: post.line,
                url: post.url
            });

            return this.sendRespuesta<IDeleteOUT>(conexion, {
                data: {
                    deleted
                }
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
                        exact: '/private/logs/error/list/',
                        resumen: '/private/logs/error/list/',
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
                            services: {
                                regex: /\w+(?:(?:;\w+)?)+/,
                                opcional: true
                            },
                            files: {
                                regex: /\w+(?:(?:;\w+)?)+/,
                                opcional: true
                            },
                            lines: {
                                regex: /\d+(?:(?:;\d+)?)+/,
                                opcional: true
                            },
                            urls: {
                                regex: /[A-Z\d\/.:]+(?:(?:;[A-Z\d\/.:]+)?)+/,
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
                        exact: '/private/logs/error/available-filters/',
                        resumen: '/private/logs/error/available-filters/',
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
                        exact: '/private/logs/error/delete/',
                        resumen: '/private/logs/error/delete/',
                        internal: true
                    }
                ],
                handler: async (conexion) => {
                    return await this.handleDelete(conexion);
                }
            }
        ];
    }
}

let instance: Error|null = null;
export default (config: Configuracion) => instance??=new Error(config);
