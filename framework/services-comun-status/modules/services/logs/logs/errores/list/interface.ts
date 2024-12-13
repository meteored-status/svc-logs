export interface IListIN {
    projects: string;
    page?: string;
    perPage?: string;
    services?: string;
    url?: string;
    lines?: string;
    files?: string;
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
    url: string;
    line: number;
    file: string;
    message: string;
    trace: string[];
    ctx: ICtx[];
}

export interface ICtx {
    line: number;
    code: string;
}
