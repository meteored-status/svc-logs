import {BigQuery} from "@google-cloud/bigquery";
import readline from "node:readline/promises";

import {arrayChop} from "services-comun/modules/utiles/array";
import {error} from "services-comun/modules/utiles/log";
import {Storage} from "services-comun/modules/fs/storage";

import {Cliente} from "../cliente";
import {type IRAWData, type IRegistroES, Registro} from "../registro";
import SCHEMA from "./cloudflare";

const FILTRAR_PATHS_PREFIX: string[] = [
    "/cdn-cgi/"
];

const BQ = new BigQuery({
    keyFilename: "files/credenciales/bigquery.json",
});

async function guardar(buffer: IRegistroES[]): Promise<void> {
    for (const chunk of arrayChop(buffer, 1000)) {
    await BQ.dataset("logs").table(`accesos`).insert(chunk)
        .catch((err) => {
            error("Error guardando registros en BigQuery", JSON.stringify(err));
        });
    }
}

export default async (cliente: Cliente, storage: Storage)=>{
    const lector = readline.createInterface({
        input: storage.stream,
        crlfDelay: Infinity,
        terminal: false,
    });

    const buffer: IRegistroES[] = [];

    for await (const linea of lector) {
        if (linea.length===0) {
            // ignoramos las lineas vacías tal como puede ser la de final de archivo
            continue;
        }

        const cf: IRAWData = SCHEMA.parse(JSON.parse(linea.trim()));
        if (FILTRAR_PATHS_PREFIX.some(path=>cf.client.request.path.startsWith(path))) {
            continue;
        }

        buffer.push(Registro.build(cf, cliente).toJSON());
    }

    guardar(buffer).then(() => undefined);
}
