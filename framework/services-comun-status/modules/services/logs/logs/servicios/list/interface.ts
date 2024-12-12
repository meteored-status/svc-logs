import {ESeverity} from "../../interface";

export interface IListIN {
    projects: string;
    page?: string;
    perPage?: string;
    severity?: string;
    services?: string;
    types?: string;
    ts_from?: string;
    ts_to?: string;
}

export interface IListOUT {
    logs: ILog[];
}

export interface ILog {
    timestamp: number;
    project: string;
    service: string;
    type: string;
    severity: ESeverity;
    message: string;
}
