import {CustomError} from "../../utiles/error";
import {ErrorCode, IErrorInfo} from "../interface";

export interface IRequestError extends IErrorInfo {
    status: number;
    url: string;
    headers: Headers;
}

export class RequestError extends CustomError {
    /* STATIC */
    // public static check(err: any): boolean {
    //     // en browser la primera parte no se cumple
    //     return err instanceof RequestError  || ("url" in err && "headers" in err && "code" in err && "message" in err);
    // }
    //
    // public static instanceof(err: any): RequestError|null {
    //     return this.check(err) ? err : null;
    // }

    /* INSTANCE */
    public status: number;
    public readonly url: string;
    public readonly headers: Headers;
    public readonly code: ErrorCode;
    public readonly extra?: any;

    public constructor(info: IRequestError) {
        super(info.message);

        this.name = "RequestError";
        this.status = info.status;
        this.url = info.url;
        this.headers = info.headers;
        this.code = info.code;
        this.extra = info.extra;
    }

    public override toString(): string {
        return `${this.code}: ${this.message}`;
    }
}
