import { info} from "./log";
import {dirname} from "node:path";
import {isFile, mkdir, readJSON} from "./fs";

/**
 * Comprueba la existencia del fichero json, y devuelve
 * su contenido, en caso de no existir crea el directorio
 * y devuelve undefined.
 * @param filePath del archivo a leer.
 * @return contendio del fichero o undefined.
 * */
export async function checkJsonFile<T>(filePath: string): Promise<T|undefined> {
    info("comprobando existencia de fichero");
    if (await isFile(filePath)) {
        return await readJSON<T>(filePath);
    }
    info("fichero inexistente, creando directorio");
    await mkdir(dirname(filePath), true);
    info("directorio creado");

    return undefined;
}
