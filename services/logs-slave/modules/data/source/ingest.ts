import {BigQuery} from "@google-cloud/bigquery";
import readline from "node:readline/promises";

import {arrayChop} from "services-comun/modules/utiles/array";
import {error} from "services-comun/modules/utiles/log";
import {Storage} from "services-comun/modules/fs/storage";

import {Cliente} from "../cliente";
import {type IRAWData, type IRegistroCrawler, type IRegistroES, Registro} from "../registro";
import SCHEMA from "./cloudflare";

const FILTRAR_PATHS_PREFIX: string[] = [
    "/cdn-cgi/"
];

const BQ = new BigQuery({
    keyFilename: "files/credenciales/bigquery.json",
});

async function guardar(accesos: IRegistroES[], crawler: IRegistroCrawler[]): Promise<void> {
    if (accesos.length===0 || crawler.length===0) {
        return;
    }

    const dataset = BQ.dataset("logs");

    if (accesos.length>0) {
        const tablaAccesos = dataset.table(`accesos`);
        for (const chunk of arrayChop(accesos, 1000)) {
            await tablaAccesos.insert(chunk)
                .catch((err) => {
                    error("Error guardando registros de accesos en BigQuery", JSON.stringify(err));
                });
        }
    }

    if (crawler.length>0) {
        const tablaCrawler = dataset.table(`accesos`);
        for (const chunk of arrayChop(crawler, 1000)) {
            await tablaCrawler.insert(chunk)
                .catch((err) => {
                    error("Error guardando registros de crawler en BigQuery", JSON.stringify(err));
                });
        }
    }
}

export default async (cliente: Cliente, storage: Storage)=>{
    const lector = readline.createInterface({
        input: storage.stream,
        crlfDelay: Infinity,
        terminal: false,
    });

    const accesos: IRegistroES[] = [];
    const crawler: IRegistroCrawler[] = [];

    for await (const linea of lector) {
        if (linea.length===0) {
            // ignoramos las lineas vacías tal como puede ser la de final de archivo
            continue;
        }

        const cf: IRAWData = SCHEMA.parse(JSON.parse(linea.trim()));
        if (FILTRAR_PATHS_PREFIX.some(path=>cf.client.request.path.startsWith(path))) {
            continue;
        }

        const registro = Registro.build(cf, cliente);
        accesos.push(registro.toJSON());
        if (cf.client.ip.class.includes("Search Engine")) {
            crawler.push(registro.toCrawler());
        }
    }

    guardar(accesos, crawler).then(() => undefined);
}
