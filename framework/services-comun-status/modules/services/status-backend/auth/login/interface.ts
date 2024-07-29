import {EPermission} from "../interface";

export interface ILoginIN {
    lang: string;
    timezone: string;
    name?: string;
}

export interface ILoginOUT {
    name: string;
    email: string;
    avatar?: string;
    permissions: EPermission[]
    departments: number[];
    services: number[];
}
