import {TService} from "./config";

export interface IService {
    id: TService;
    endpoints: IEndpoint[];
}

export interface IEndpoint {
    url: string;
}
