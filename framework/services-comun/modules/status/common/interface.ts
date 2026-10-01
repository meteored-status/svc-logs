/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 6247724add086113f0ad8b41f5b0c81e
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {TMetodo} from "@mr/core-network/server/http/conexion";

export enum TStatus {
    OK = 3,
    WARN = 2,
    ERROR = 1,
    UNKNOWN = 4
}

export interface IComponent {
    name: string;
    service: number|{
        id: number
    };
    monitors: IMonitor[];
    updated: Date;
}

export interface IService {
    id: number;
    name: string;
    project_name: string;
}

export interface IMonitor {
    name: string;
    status: TStatus,
    updated: Date;
    monitors?: IMonitor[];
    message?: string;
    log?: string;
    resource_responses?: IResourceResponse[];
    resolution_guides?: IResolutionGuide[];
}

export interface IResourceResponse {
    url: string;
    verb: TMetodo;
    http_code: number;
    headers: NodeJS.Dict<any>;
    raw: string;
    time: number;
}

export interface IResolutionGuide {
    inline?: string;
    link?: string;
    ref?: string;
    contact: IResolutionContact;
}

export interface IResolutionContact {
    name: string;
    email: string;
}
