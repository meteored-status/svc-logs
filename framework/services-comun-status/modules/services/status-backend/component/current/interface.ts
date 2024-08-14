import {IResolutionGuide, IResourceResponse} from "services-comun/modules/status/common/interface";

export interface ICurrentOUT {
    services: IService[];
}

export interface IService {
    id: number;
    name: string;
    project_name: string;
    updated: number;
    status: number;
    error_count: number;
    warn_count: number;
    components: IComponent[];
}

export interface IComponent {
    name: string;
    status: number;
    error_count: number;
    warn_count: number;
    monitors: IMonitor[];
    disabled: boolean;
}

export interface IMonitor {
    key: string;
    name: string;
    status: number;
    updated: number;
    error_count: number;
    warn_count: number;
    monitors: IMonitor[];
    message?: string;
    log?: string;
    resource_responses?: IResourceResponse[];
    resolution_guides?: IResolutionGuide[];
    disabled: boolean;
}
