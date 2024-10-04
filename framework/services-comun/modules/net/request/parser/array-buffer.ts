import {Parser} from ".";
import {Respuesta} from "../respuesta";

async function parser(response: Response): Promise<Respuesta<ArrayBuffer>> {
    return new Respuesta<ArrayBuffer>(response, await response.arrayBuffer());
}

export default parser as Parser<ArrayBuffer>;
