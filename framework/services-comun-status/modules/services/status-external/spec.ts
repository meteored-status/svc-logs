export interface IToLoad {
    id: string;
    service: number;
    data: string;
}

export interface IQueryLoad {
    service: number;
    group?: string;
}

export interface IPostSave {
    id?: string;
    service: number;
    group?: string;
    data: string;
}
