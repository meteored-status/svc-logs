import {IRequestConfig, Request, RequestResponse} from "./request";
import {error} from "../browser/log";

export class FrontendRequest extends Request {
    /* STATIC */
    // protected static override async get<T>(url: string, cfg: IRequestConfig={}): Promise<RequestResponse<T>> {
    //     return this.fetch<T>(url, {}, new Headers(), cfg);
    // }

    protected static async postJSON<T,S>(url: string, data: S, cfg: IRequestConfig={}): Promise<RequestResponse<T>> {
        const headers = new Headers();
        headers.append("Accept", "application/json");
        headers.append("Content-Type", "application/json");
        return this.fetch<T>(url, {
            method: "POST",
            body: JSON.stringify(data),
        }, headers, cfg);
    }

    protected static error(...txt: any): void {
        error(txt);
    }

    /* INSTANCE */
}
