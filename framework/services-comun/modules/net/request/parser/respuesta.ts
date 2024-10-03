import {ErrorCode, type IRespuesta} from "../../interface";
import {RequestError} from "../error";
import {Respuesta} from "../respuesta";

async function parser<T>(response: Response): Promise<Respuesta<T>> {
    const data = await response.json() as IRespuesta<T>;
    if (data.ok===undefined) {
        return Promise.reject(new RequestError({
            status: response.status,
            url: response.url,
            headers: response.headers,
            code: ErrorCode.RESPONSE,
            message: "Incorrect response",
        }));
    }

    if (data.ok) {
        return new Respuesta<T>(response, data.data, new Date(data.expiracion));
    }

    return Promise.reject(new RequestError({
        status: response.status,
        url: response.url,
        headers: response.headers,
        ...data.info,
    }));
}

export default parser;
