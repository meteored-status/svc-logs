export interface ISaveIN {
    id?: number;
    name: string;
    project_name: string;
    department: number;
    dynamic_resources: string[];
}

export interface ISaveOUT {
    id: number;
    name: string;
    project_name: string;
    department: number;
    dynamic_resources: string[];
}
