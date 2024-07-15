export enum ErrorCode {
    NETWORK           = 1,
    TIMEOUT           = 2,
    AUTHENTICATION    = 3,
    RESPONSE          = 4,
    APPLICATION       = 5,
    NO_DATA_TEMPORARY = 6,
    NO_DATA_PERMANENT = 7,
}

export interface IErrorInfo {
    code: ErrorCode;
    message: string;
    extra?: any;
}

export interface IOK<T> {
    expiracion: Date;
    etag: string;
    data: T;
}

export interface IRespuestaOK<T> {
    ok: true;
    expiracion: number;
    data: T;
    info?: IErrorInfo;
}

export interface IRespuestaKO<T=undefined> {
    ok: false;
    expiracion?: number;
    data?: T;
    info: IErrorInfo;
}

export type IRespuesta<T=undefined> = IRespuestaOK<T>|IRespuestaKO<T>;
