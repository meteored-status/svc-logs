import {TMetodo} from "../../net/conexion";

export enum TStatus {
    OK = 3,
    WARN = 2,
    ERROR = 1,
    UNKNOWN = 4
}

export interface IComponent {
    name: string;
    service: IService;
    monitors: IMonitor[];
    updated: Date;
}

export interface IService {
    id: number;
    name: string;
    project_name: string;
    namespace: string;
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
