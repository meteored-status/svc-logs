import {Google} from "services-comun/modules/utiles/config";
import {type INotify} from "services-comun-status/modules/services/logs-slave/backend";
import {Storage} from "services-comun/modules/fs/storage";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";

export interface IBucketMySQL {
    id: string;
    cliente: string;
    grupo: string|null;
}

export interface ICliente {
    id: string;
    grupo?: string;
}

export class Bucket {
    /* STATIC */
    public static buildSource(notify: INotify): string {
        return `gs://${notify.bucketId}/${notify.objectId}`;
    }

    /* INSTANCE */
    public readonly id: string;
    public readonly cliente: string;
    public readonly grupo?: string;

    protected constructor(data: IBucketMySQL) {
        this.id = data.id;
        this.cliente = data.cliente;
        this.grupo = data.grupo??undefined;
    }

    public getCliente(): ICliente {
        return {
            id: this.cliente,
            grupo: this.grupo,
        };
    }

    private async getArchivoErr(config: Google, bucket: string, file: string, retry: number, err: any): Promise<Storage|null> {
        if (err?.code == 404) {
            return null;
        }

        if (retry >= 10) {
            return Promise.reject(`Error obteniendo archivo: gs://${bucket}/${file} => ${JSON.stringify(err)}`);
        }

        retry++;
        await PromiseDelayed(1000 * retry);
        return this.getArchivo(config, bucket, file, retry);
    }

    protected async getArchivo(config: Google, bucket: string, file: string, retry: number = 0): Promise<Storage|null> {
        try {
            return Storage.getOne(config, bucket, file)
                .catch(async (err) => this.getArchivoErr(config, bucket, file, retry, err));
        } catch (err) {
            return this.getArchivoErr(config, bucket, file, retry, err);
        }
    }
}
