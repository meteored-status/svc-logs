import {Parser} from ".";
import {Respuesta} from "../respuesta";

async function parser(response: Response): Promise<Respuesta<Buffer>> {
    return new Respuesta<Buffer>(response, Buffer.from(await response.arrayBuffer()));
}

export default parser as Parser<Buffer>;
