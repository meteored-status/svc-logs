import {Parser} from ".";
import {Respuesta} from "../respuesta";

async function parser(response: Response): Promise<Respuesta<string>> {
    return new Respuesta<string>(response, await response.text());
}

export default parser as Parser<string>;
