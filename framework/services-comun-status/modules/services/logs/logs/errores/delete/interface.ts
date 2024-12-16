export interface IDeleteIN {
    project: string;
    ts?: number;
    service?: string;
    file?: string;
    line?: number;
    url?: string;
}

export interface IDeleteOUT {
    deleted: number;
}
