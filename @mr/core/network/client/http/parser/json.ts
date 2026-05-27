import {Respuesta} from "../respuesta";

async function parser<T>(response: Response): Promise<Respuesta<T>> {
    return new Respuesta<T>(response, await response.json());
}

export default parser;
