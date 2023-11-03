import { IResolutionGuide } from "../common/interface";
import {TService} from "../config";

export interface IChecker {
    service: TService;
    resource_group: IResourceGroup[];
}

export interface IResourceGroup {
    name: string;
    resources: IResource[];
}

export interface IResource {
    name: string;
    urls: IUrl[];
}

export interface IUrl {
    url: string;
    method: "GET"|"POST"|"HEAD";
    alternate_responses?: IAlternateResponse[];
    error_responses?: IAlternateResponse[];
    warning_responses?: IAlternateResponse[];
    resolution_guides?: IResolutionGuide[];
    headers?: IHeaders;
    body?: any;
}

export type TAlternateResponse = "JSON"|"Buffer";

export interface IAlternateResponse {
    code: number;
    type: TAlternateResponse;
    field?: string;
    field_value?: string;
    field_empty?: boolean;
    resolution_guides?: IResolutionGuide[];
}

export interface IHeaders {
    [key: string]: string;
}
