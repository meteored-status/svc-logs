import type {Google} from "services-comun/modules/utiles/config";
import {Storage} from "services-comun/modules/fs/storage";

import {ClienteError} from "./error";
import {Grupo} from "./grupo";
import ingest from "../source/ingest";

import type {Cliente} from "./index";

type GCSTipo = "cloudflare";

interface IClienteGCS {
    bucket: string;
    tipo: GCSTipo;
}

interface IClienteGCSMySQL extends IClienteGCS {
    cliente: string;
    grupo?: string;
}

export class ClienteGCS implements IClienteGCS {
    /* STATIC */
    private static BUCKETS: Record<string, Record<string, IClienteGCSMySQL>> = {
        "cf-accesos": {
            "ed": {
                bucket: "cf-accesos",
                cliente: "ed",
                tipo: "cloudflare"
            },
            "fce": {
                bucket: "cf-accesos",
                cliente: "fce",
                tipo: "cloudflare"
            },
            "motor": {
                bucket: "cf-accesos",
                cliente: "motor",
                tipo: "cloudflare"
            },
            "mr": {
                bucket: "cf-accesos",
                cliente: "mr",
                tipo: "cloudflare"
            },
            "tiempo-ar": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "ar",
                tipo: "cloudflare"
            },
            "tiempo-at": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "at",
                tipo: "cloudflare"
            },
            "tiempo-bo": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "bo",
                tipo: "cloudflare"
            },
            "tiempo-br": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "br",
                tipo: "cloudflare"
            },
            "tiempo-ca": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "ca",
                tipo: "cloudflare"
            },
            "tiempo-cl": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "cl",
                tipo: "cloudflare"
            },
            "tiempo-cr": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "cr",
                tipo: "cloudflare"
            },
            "tiempo-de": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "de",
                tipo: "cloudflare"
            },
            "tiempo-do": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "do",
                tipo: "cloudflare"
            },
            "tiempo-ec": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "ec",
                tipo: "cloudflare"
            },
            "tiempo-en": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "en",
                tipo: "cloudflare"
            },
            "tiempo-es": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "es",
                tipo: "cloudflare"
            },
            "tiempo-eu": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "eu",
                tipo: "cloudflare"
            },
            "tiempo-fr": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "fr",
                tipo: "cloudflare"
            },
            "tiempo-hn": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "hn",
                tipo: "cloudflare"
            },
            "tiempo-it": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "it",
                tipo: "cloudflare"
            },
            "tiempo-mx": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "mx",
                tipo: "cloudflare"
            },
            "tiempo-nl": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "nl",
                tipo: "cloudflare"
            },
            "tiempo-pa": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "pa",
                tipo: "cloudflare"
            },
            "tiempo-pe": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "pe",
                tipo: "cloudflare"
            },
            "tiempo-pt": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "pt",
                tipo: "cloudflare"
            },
            "tiempo-py": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "py",
                tipo: "cloudflare"
            },
            "tiempo-ru": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "ru",
                tipo: "cloudflare"
            },
            "tiempo-uy": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "uy",
                tipo: "cloudflare"
            },
            "tiempo-ve": {
                bucket: "cf-accesos",
                cliente: "tiempo",
                grupo: "ve",
                tipo: "cloudflare"
            },
        }
    };

    public static async searchBucket(bucket: string, dir: string): Promise<ClienteGCS> {
        const path = dir.split("/")[0];
        const data = this.BUCKETS[bucket]?.[path];
        if (!data) {
            return Promise.reject(new ClienteError(`GCS ${bucket}/${path} no encontrado`));
        }
        return new this(await Grupo.searchID(data.cliente, data.grupo), data);
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
                console.log(err.message);
            } else {
                console.log(JSON.stringify(err));
            }

            return;
        }
    }

    public async ingest(storage: Google, source: string): Promise<void> {
        const data = await this.getArchivo(storage, this.bucket, source);
        if (!data) {
            return;
        }

        try {
            await ingest(this.cliente, data);
        } catch (err) {
            if (!(err instanceof Error) || !err.message.includes("No such object")) {
                return Promise.reject(err);
            }
        }
        await data.delete();
    }
}
