export interface IAvaliableFiltersIN {
    projects: string;
}

export interface IAvaliableFiltersOUT {
    services: string[];
    urls: string[];
    files: string[];
    lines: number[];
}
