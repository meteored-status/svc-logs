import {BigQuery, type Dataset} from "@google-cloud/bigquery";
import readline from "node:readline/promises";

import {PromiseChainWTB} from "services-comun/modules/utiles/promise";
import {arrayChop} from "services-comun/modules/utiles/array";
import {error} from "services-comun/modules/utiles/log";

import {type ISalida, nuevaSalida, procesarLinea} from "./parser";

import type {Cliente} from "../cliente";
import type {Storage} from "services-comun/modules/fs/storage";

const DATASET = "logs";
const BLOQUE_BIGQUERY = 1000;

/**
 * Bloques que se insertan a la vez. El volcado se espera antes de responder —si no, Cloud Run
 * estrangula la CPU al enviar la respuesta y la escritura se queda a medias—, así que la request
 * dura lo que dure el volcado. En serie, un fichero grande son decenas de llamadas encadenadas y
 * se rebasa el ack deadline de la suscripción push de Pub/Sub; con esta concurrencia el tiempo de
 * pared baja a una fracción sin castigar a BigQuery.
 */
const CONCURRENCIA_BIGQUERY = 8;

/** Tope de incidencias que se loguean por fichero; el resto solo cuenta para el resumen. */
const MAX_ERRORES_LOG = 10;

/**
 * Cliente de BigQuery, creado bajo demanda. Se construye al margen de la abstracción `Google` que
 * usa el resto del servicio para Cloud Storage, así que la ruta de credenciales está aquí a mano:
 * `mrpack.json` las inyecta bajo `credenciales[].target: "bigquery.json"`.
 */
let bq: BigQuery|undefined;
const getBQ = (): BigQuery => bq ??= new BigQuery({
    keyFilename: "files/credenciales/bigquery.json",
});

/**
 * Resumen de la ingesta de un fichero.
 *
 * @property lineas    - Líneas no vacías leídas del fichero.
 * @property invalidas - Líneas descartadas por no poder parsearse.
 * @property salida    - Filas generadas para cada tabla.
 * @property guardado  - `false` si alguna inserción en BigQuery falló; el objeto no debe borrarse.
 */
export interface IResultado {
    lineas: number;
    invalidas: number;
    salida: ISalida;
    guardado: boolean;
}

/** Un bloque de filas destinado a una tabla concreta. */
interface IBloque {
    tabla: string;
    filas: unknown[];
}

const trocear = (tabla: string, data: unknown[]): IBloque[] =>
    arrayChop(data, BLOQUE_BIGQUERY).map(filas=>({tabla, filas}));

const insertar = async (dataset: Dataset, bloque: IBloque): Promise<boolean> => {
    try {
        await dataset.table(bloque.tabla).insert(bloque.filas);

        return true;
    } catch (err) {
        error(`Error guardando ${bloque.filas.length} registros de ${bloque.tabla} en BigQuery`, JSON.stringify(err));

        return false;
    }
};

const guardar = async (salida: ISalida): Promise<boolean> => {
    const bloques = [
        ...trocear("accesos", salida.accesos),
        ...trocear("accesos_crawler", salida.crawler),
        ...trocear("accesos_app", salida.app),
    ];
    if (bloques.length===0) {
        return true;
    }

    const dataset = getBQ().dataset(DATASET);
    const resultados = await PromiseChainWTB(bloques.map(bloque=>async ()=>insertar(dataset, bloque)), 0, CONCURRENCIA_BIGQUERY);

    return resultados.every(ok=>ok);
};

export default async (cliente: Cliente, storage: Storage): Promise<IResultado> => {
    const lector = readline.createInterface({
        input: storage.stream,
        crlfDelay: Infinity,
        terminal: false,
    });

    const salida = nuevaSalida();
    let lineas = 0;
    let invalidas = 0;

    for await (const actual of lector) {
        const linea = actual.trim();
        if (linea.length===0) {
            // ignoramos las lineas vacías tal como puede ser la de final de archivo
            continue;
        }
        lineas++;

        try {
            procesarLinea(cliente, linea, salida);
        } catch (err) {
            // una línea corrupta no puede tirar el fichero entero: la descartamos y seguimos
            invalidas++;
            if (invalidas<=MAX_ERRORES_LOG) {
                error("Línea de log descartada", err instanceof Error ? err.message : JSON.stringify(err));
            }
        }
    }

    if (invalidas>0) {
        error(`Descartadas ${invalidas} de ${lineas} líneas`);
    }
    for (const mensaje of salida.appInvalidas.slice(0, MAX_ERRORES_LOG)) {
        error(mensaje);
    }
    if (salida.appInvalidas.length>MAX_ERRORES_LOG) {
        error(`Descartadas ${salida.appInvalidas.length} peticiones de app con header inválido`);
    }

    return {
        lineas,
        invalidas,
        salida,
        guardado: await guardar(salida),
    };
};
