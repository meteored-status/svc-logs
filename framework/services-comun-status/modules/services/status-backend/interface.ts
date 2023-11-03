import {IResolutionGuide, IResourceResponse } from "services-comun/modules/status/common/interface";
import {TService} from "services-comun/modules/status/config";
import {IResourceGroup} from "services-comun/modules/status/resource/resource";

export interface IToStatusMonitor {
    name: string;
    status: number;
    updated: number;
    error_count: number;
    warn_count: number;
    monitors: IToStatusMonitor[];
    message?: string;
    log?: string;
    resource_responses?: IResourceResponse[];
    resolution_guides?: IResolutionGuide[];
}

export interface IToStatusComponent {
    name: string;
    status: number;
    error_count: number;
    warn_count: number;
    monitors: IToStatusMonitor[];
}

export interface IToStatus {
    id: number;
    name: string;
    project_name: string;
    namespace: string;
    updated: number;
    status: number;
    error_count: number;
    warn_count: number;
    components: IToStatusComponent[];
}

export interface IServiceResourceList {
    service: TService;
    service_name: string;
    service_project: string;
    id?: string;
    name: string;
    namespace: string;
    resource_group: IResourceGroup[];
}

export interface IRespuestaIServiceResourceList {
    services: IServiceResourceList[];
}

export interface IServiceResource {
    service: TService;
    id?: string;
    name: string;
    namespace: string;
    resource_group: IResourceGroup[];
}

export interface IToGuardian {
    name: string;
    email: string;
}

export interface IPostSaveResource extends IServiceResource {

}
