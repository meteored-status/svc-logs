export interface IToLoad {
    service: number;
    name: string;
    data: string;
}

export interface IQueryLoad {
    service: number;
    name: string;
}

export interface IPostSave {
    service: number;
    name: string;
    data: any;
}
