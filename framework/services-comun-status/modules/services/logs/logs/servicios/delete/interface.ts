export interface DeleteAction {
    timestamp?: number;
    severities?: string[];
    services?: string[];
    types?: string[];
    messages?: string[];
}

export interface IDeleteIN {
    projects: string[];
    action: DeleteAction;
}

export interface IDeleteOUT {

}
