import {TService} from "services-comun/modules/status/config";
import {IResourceGroup} from "services-comun/modules/status/resource/resource";

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
