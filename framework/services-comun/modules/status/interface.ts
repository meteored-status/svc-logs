export interface IService {
    id: number;
    endpoints: IEndpoint[];
}

export interface IEndpoint {
    url: string;
}
