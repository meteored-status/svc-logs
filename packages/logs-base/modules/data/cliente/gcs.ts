import type {IInsert} from "services-comun/modules/database/mysql";
import type {Google, IPodInfo} from "services-comun/modules/utiles/config";
import {Storage} from "services-comun/modules/fs/storage";
import {error} from "services-comun/modules/utiles/log";
import db from "services-comun/modules/utiles/mysql";

import {Cloudflare} from "../source/cloudflare";
import {Telemetry} from "../telemetry";
import {ClienteError} from "./error";
import {Grupo} from "./grupo";

import {type Cliente} from ".";

export type BucketClienteGCS = Record<string, ClienteGCS>;

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
        // const [cliente] = await db.select<IClienteGCSMySQL, ClienteGCS>(`SELECT * FROM gcs WHERE bucket=?`, [bucket], {
        //     fn: async (raw)=>new this(await Grupo.searchID(raw.cliente, raw.grupo), raw),
        //     // cache: {
        //     //     builder,
        //     //     key: bucket,
        //     //     ttl: 600000,
        //     // },
        // });
        // if (cliente==undefined) {
        //     return Promise.reject(new ClienteError(`GCS ${bucket} no encontrado`));
        // }
        //
        // return cliente;
    }

    public static async searchAll(): Promise<BucketClienteGCS> {
        const clientes = await db.select<IClienteGCSMySQL, ClienteGCS>(`SELECT * FROM gcs`, [], {
            fn: async (raw)=>new this(await Grupo.searchID(raw.cliente, raw.grupo), raw),
        });

        const salida: BucketClienteGCS = {};
        for (const cliente of clientes) {
            salida[cliente.bucket] = cliente;
        }

        return salida;
    }

    public static async addStatusProcesando(bucket: string, source: string): Promise<void> {
        await db.insert("INSERT INTO procesando (bucket, archivo) VALUES (?, ?) ON DUPLICATE KEY UPDATE estado=?", [bucket, source, "recibido"]);
    }

    private static PRIMERO = true;

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

    public async addStatusProcesando(source: string): Promise<void> {
        await db.update("UPDATE procesando SET estado=? WHERE bucket=? AND archivo=?", ["procesando", this.bucket, source]);
    }

    public async addStatusRepescando(source: string): Promise<void> {
        await db.insert("INSERT INTO procesando (bucket, archivo, estado) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE estado=?", [this.bucket, source, "repescando", "repescando"]);
    }

    public async addStatusTerminado(source: string): Promise<void> {
        await db.delete("DELETE FROM procesando WHERE bucket=? AND archivo=?", [this.bucket, source]);
    }

    public async addStatusError(source: string): Promise<void> {
        await db.delete("DELETE FROM procesando WHERE bucket=? AND archivo=?", [this.bucket, source]);
    }

    public async addStatusRepesca(source: string, repesca: boolean, err?: any): Promise<void> {
        if (ClienteGCS.PRIMERO) {
            ClienteGCS.PRIMERO = false;
            error(err);
        }

        let mensaje: string|null;
        if (err!=undefined) {
            if (err instanceof Error) {
                mensaje = err.message;
            } else {
                mensaje = JSON.stringify(err);
            }
        } else {
            mensaje = null;
        }
        const origen = !repesca?"ingest":"repesca";

        await db.insert("INSERT INTO repesca (bucket, archivo, mensaje, origen) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE contador=contador+1, mensaje=?, origen=?", [this.bucket, source, mensaje, origen, mensaje, origen]);
    }

    public async pescarHuerfanos(google: Google, fechas: string[]): Promise<void> {
        const bloques = await Promise.all(fechas.map(fecha=>Storage.list(google, this.bucket, fecha)));
        const files: IInsert[] = bloques.flat().map(file=>{
            const data = file.name.split("/")
                .at(-1)!
                .split("_")
                .at(0)!
                .replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z"); // esto incluye la fecha
            const fecha = new Date(data);
            return {
                table: "repesca",
                query: "INSERT INTO repesca (bucket, archivo, origen, fecha) VALUES (?, ?, ?, ?)",
                params: [this.bucket, file.name, "huerfano", fecha],
                duplicate: ["bucket", "archivo"],
            };
        });
        await db.bulkInsert(files);
        // todo esto se usa?
        // await db.update("UPDATE repesca, procesando SET repesca.tratando=1 WHERE repesca.bucket=procesando.bucket AND repesca.archivo=procesando.archivo");
    }

    private async getArchivo(config: Google, bucket: string, file: string): Promise<Storage|null> {
        try {
            return await Storage.getOne(config, bucket, file);
        } catch (err: any) {
            if (err && "code" in err && err.code === 404) {
                return null;
            }

            return Promise.reject(new Error(`Error obteniendo archivo: gs://${bucket}/${file} => ${JSON.stringify(err)}`));
        }
    }

    public async ingest(pod: IPodInfo, storage: Google, source: string): Promise<void> {
        await this.addStatusProcesando(source);

        const data = await this.getArchivo(storage, this.bucket, source);
        if (data==null) {
            return;
        }

        const telemetry = Telemetry.build(this.cliente, pod, source);
        await Cloudflare.ingest(telemetry, data);
        await db.delete("DELETE FROM repesca WHERE bucket=? AND archivo=?", [this.bucket, source]);
        await data.delete();
        await this.addStatusTerminado(source);
    }
}
