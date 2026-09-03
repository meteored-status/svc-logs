import {type Google} from "@mr/core-workload/config/google";
import {Storage} from "services-comun/modules/fs/storage";
import {error, info} from "services-comun/modules/utiles/log";

import {ClienteError} from "./error";
import {Grupo} from "./grupo";
import ingest from "../source/ingest";

import type {Cliente} from "./index";

type GCSTipo = "cloudflare";

interface IClienteGCS {
    bucket: string;
    tipo: GCSTipo;
}

/**
 * Entrada del catálogo de buckets.
 *
 * @property cliente - Id del `Cliente` al que pertenece la carpeta.
 * @property grupo   - Subproyecto regional, si el cliente lo distingue (p.ej. `es` en `tiempo-es`).
 * @property tipo    - Formato del log; por defecto `cloudflare`.
 */
interface ICatalogoGCS {
    cliente: string;
    grupo?: string;
    tipo?: GCSTipo;
}

const TIPO_DEFECTO: GCSTipo = "cloudflare";

/** Subproyectos regionales del cliente `tiempo`, uno por país/idioma. */
const TIEMPO_GRUPOS: string[] = [
    "ar", "at", "bo", "br", "ca", "cl", "cr", "de", "do", "ec", "en", "es", "eu",
    "fr", "hn", "it", "mx", "nl", "pa", "pe", "pt", "py", "ru", "uy", "ve",
];

export class ClienteGCS implements IClienteGCS {
    /* STATIC */
    /**
     * Catálogo `bucket → primera carpeta del path → cliente`. Vive en código, no en configuración
     * externa ni en MySQL: añadir un cliente o un subproyecto exige tocar este fichero y redesplegar.
     */
    private static readonly BUCKETS: Record<string, Record<string, ICatalogoGCS>> = {
        "cf-accesos": {
            "ed": {cliente: "ed"},
            "fce": {cliente: "fce"},
            "hoteles": {cliente: "hoteles"},
            "motor": {cliente: "motor"},
            "motenic": {cliente: "motenic"},
            "mr": {cliente: "mr"},
            ...Object.fromEntries(TIEMPO_GRUPOS.map(grupo=>[`tiempo-${grupo}`, {cliente: "tiempo", grupo}])),
        },
    };

    public static async searchBucket(bucket: string, dir: string): Promise<ClienteGCS> {
        const path = dir.split("/")[0];
        const data = this.BUCKETS[bucket]?.[path];
        if (!data) {
            return Promise.reject(new ClienteError(`GCS ${bucket}/${path} no encontrado`));
        }

        return new this(await Grupo.searchID(data.cliente, data.grupo), {
            bucket,
            tipo: data.tipo ?? TIPO_DEFECTO,
        });
    }

    /* INSTANCE */
    public readonly bucket: string;
    public readonly tipo: GCSTipo;

    private constructor(public readonly cliente: Cliente, data: IClienteGCS) {
        this.bucket = data.bucket;
        this.tipo = data.tipo;

        this.enableCliente();
    }

    private enableCliente(): ClienteGCS {
        this.cliente.aplicarGCS(this);

        return this;
    }

    private async getArchivo(config: Google, bucket: string, file: string): Promise<Storage|undefined> {
        try {
            return await Storage.getOne(config, bucket, file);
        } catch (err) {
            if (err instanceof Error && err.message.includes("No such object")) {
                info(`El objeto ${bucket}/${file} ya no existe`);
            } else {
                error(`Error accediendo a ${bucket}/${file}`, err instanceof Error ? err.message : JSON.stringify(err));
            }

            return undefined;
        }
    }

    /**
     * Descarga el objeto, lo vuelca a BigQuery y solo entonces lo borra del bucket. Si el volcado
     * falla, el objeto se conserva para poder repescarlo (ver `mapping/repesca-errores.sh`).
     */
    public async ingest(storage: Google, source: string): Promise<void> {
        const data = await this.getArchivo(storage, this.bucket, source);
        if (data===undefined) {
            return;
        }

        const resultado = await ingest(this.cliente, data);
        if (!resultado.guardado) {
            error(`No se ha podido volcar ${this.bucket}/${source} a BigQuery; se conserva el objeto para repesca`);

            return;
        }

        await data.delete();
    }
}
