export interface IGetUserServicesOUT {
    services: IService[];
}

export interface IService {
    id: number;
    name: string;
    deparment: {
        id: number;
        name: string;
    },
    project_name: string;
}
