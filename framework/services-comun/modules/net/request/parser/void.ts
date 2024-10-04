import {Parser} from ".";
import {Respuesta} from "../respuesta";

async function parser(response: Response): Promise<Respuesta<void>> {
    return new Respuesta<void>(response, void 0);
}

export default parser as Parser<void>;
