import {ESeverity} from "../../interface";

export interface IListIN {
    projects: string;
    page?: string;
    perPage?: string;
    severity?: string;
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
