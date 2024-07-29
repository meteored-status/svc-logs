import { IResolutionGuide } from "../common/interface";

export interface IChecker {
    service: number;
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
    tries?: number;
}

export type TAlternateResponse = "JSON"|"Buffer"|"HTML";

export interface IAlternateResponse {
    code: number;
    type: TAlternateResponse;
    resolution_guides?: IResolutionGuide[];
}

export interface IJSONAlternateResponse extends IAlternateResponse {
    type: "JSON";
    field: string;
    field_value?: string;
    field_empty?: boolean;
}

export interface IBufferAlternateResponse extends IAlternateResponse {
    type: "Buffer";
}

export interface IHTMLAlternateResponse extends IAlternateResponse {
    type: "HTML";
    fn?: string;
}

export interface IHeaders {
    [key: string]: string;
}
