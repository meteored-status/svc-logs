import {BigQuery, type Dataset} from "@google-cloud/bigquery";
import readline from "node:readline/promises";

import {arrayChop} from "services-comun/modules/utiles/array";
import {error} from "services-comun/modules/utiles/log";
import {Storage} from "services-comun/modules/fs/storage";

import {Cliente} from "../cliente";
import {type IRAWData, IRegistroApp, type IRegistroCrawler, type IRegistroES, Registro} from "../registro";
import SCHEMA from "./cloudflare";

const FILTRAR_PATHS_PREFIX: string[] = [
    "/cdn-cgi/"
];

const BQ = new BigQuery({
    keyFilename: "files/credenciales/bigquery.json",
});

async function guardarDataset<T>(dataset: Dataset, table: string, data: T[]): Promise<void> {
    if (data.length>0) {
        const tabla = dataset.table(table);
        for (const chunk of arrayChop(data, 1000)) {
            await tabla.insert(chunk)
                .catch((err) => {
                    error(`Error guardando registros de ${table} en BigQuery`, JSON.stringify(err));
                });
        }
    }
}

async function guardar(accesos: IRegistroES[], crawler: IRegistroCrawler[], app: IRegistroApp[]): Promise<void> {
    if (accesos.length===0 && crawler.length===0 && app.length===0) {
        return;
    }

    const dataset = BQ.dataset("logs");

    await guardarDataset(dataset, `accesos`, accesos);
    await guardarDataset(dataset, `accesos_crawler`, crawler);
    await guardarDataset(dataset, `accesos_app`, app);
}

export default async (cliente: Cliente, storage: Storage)=>{
    const lector = readline.createInterface({
        input: storage.stream,
        crlfDelay: Infinity,
        terminal: false,
    });

    const accesos: IRegistroES[] = [];
    const crawler: IRegistroCrawler[] = [];
    const app: IRegistroApp[] = [];

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
        if (cf.client.bot) {
            crawler.push(registro.toCrawler());
        }
        if (cf.request.headers.app || (["mr"].includes(cliente.id) && cf.client.request.path.startsWith("/app/"))) {
            try {
                app.push(registro.toApp(cf.request.headers.app));
            } catch (err) {
                if (err instanceof Error) {
                    error(err.message);
                }
            }
        }
    }

    guardar(accesos, crawler, app).then(() => undefined);
}
