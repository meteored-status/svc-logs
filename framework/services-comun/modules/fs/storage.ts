import fs from "node:fs";
import {Readable} from "node:stream";
import {type File, Storage as StorageBase} from "@google-cloud/storage";
import {Metadata} from "@google-cloud/common";

import {Google} from "../utiles/config";
import {IFile} from "./file";
import {buffer2stream, pipeline} from "../utiles/stream";
import {error} from "../utiles/log";
import {fileSize, readFile} from "../utiles/fs";
import {PromiseDelayed} from "../utiles/promise";

export interface IDocumento extends IFile {
    contentType: string;
    timeCreated: Date;
    timeUpdated: Date;
    size: Promise<number>;
}

export class Storage implements IDocumento {
    /* STATIC */
    private static storage: NodeJS.Dict<StorageBase> = {};
    private static getStorage(config: Google): StorageBase {
        return this.storage[config.id] ??= new StorageBase({
            projectId: config.id,
            keyFilename: config.storage.credenciales,
        });
    }

    public static setFiles(config: Google, buckets: string[], file: string, contentType: string): NodeJS.WritableStream[] {
        const storage = this.getStorage(config);
        return buckets.map((actual:string)=>{
            return storage.bucket(actual).file(file).createWriteStream({
                contentType,
            });
        });
    }

    private static async handleUploadBufferError(err: any, config: Google, buckets: string[], filename: string, type: string, datos: Buffer, retry: number): Promise<void> {
        if (retry < 10) {
            retry++;
            error(`Reintentando subida a Google Storage ${filename} ${retry}`);//, JSON.stringify(err));
            await PromiseDelayed(retry * 1000);
            return this.uploadBuffer(config, buckets, filename, type, datos, retry);
        }
        return Promise.reject(err);
    }

    public static async uploadBuffer(config: Google, buckets: string[], filename: string, type: string, datos: Buffer, retry: number = 0): Promise<void> {
        try {
            await this.uploadStream(config, buckets, filename, type, buffer2stream(datos)).catch(async (err) => {
                return this.handleUploadBufferError(err, config, buckets, filename, type, datos, retry);
            });
        } catch (err: any) {
            return this.handleUploadBufferError(err, config, buckets, filename, type, datos, retry);
        }
    }


    public static async uploadStream(config: Google, buckets: string[], filename: string, type: string, datos: NodeJS.ReadableStream): Promise<void> {
        const promesas: Promise<void>[] = [];
        for (const actual of this.setFiles(config, buckets, filename, type)) {
            promesas.push(pipeline(datos, actual));
        }

        await Promise.all(promesas);
    }

    public static async get(config: Google, buckets: string[], file: string): Promise<Storage> {
        if (buckets.length==0) {
            return Promise.reject();
        }
        const storage = this.getStorage(config);

        let i = 0;
        for (let actual of await Promise.all(buckets.map((actual)=>storage.bucket(actual).file(file).get().catch(async ()=>null)))) {
            if (actual!=null) {
                return new this(buckets[i], actual[0], actual[1]);
            }
            i++;
        }

        return Promise.reject();
    }

    public static async getOne(config: Google, bucket: string, file: string): Promise<Storage> {
        const storage = this.getStorage(config);

        const data = storage.bucket(bucket).file(file);
        const [metadata] = await data.getMetadata();

        return new this(bucket, data, metadata);
    }

    public static getFile(config: Google, bucket: string, file: string): File {
        return this.getStorage(config).bucket(bucket).file(file);
    }

    public static async delete(config: Google, bucket: string, file: string): Promise<boolean> {
        try {
            await this.getStorage(config).bucket(bucket).file(file).delete();
            return true;
        } catch (err) {
            return false;
        }
    }

    public static async list(config: Google, bucket: string, prefix?: string): Promise<File[]> {
        return this.getStorage(config)
            .bucket(bucket)
            .getFiles({
                autoPaginate: false,
                prefix,
                versions: false,
            })
            .then(([actual])=>actual)
            .catch(()=>[] as File[]);
    }

    public static async getAll(config: Google, buckets: string[], prefix: string): Promise<Storage[]> {
        if (buckets.length==0) {
            return Promise.reject();
        }
        const storage = this.getStorage(config);

        const promesas = buckets.map((actual)=>storage.bucket(actual).getFiles({
                autoPaginate: false,
                prefix,
                versions: false,
            }).catch(async ()=>null));

        const salida: Storage[] = [];
        let i = 0;
        for (let actual of await Promise.all(promesas)) {
            if (actual!=null) {
                const files = actual[0];
                const metadatas = await Promise.all(files.map((actual)=>actual.getMetadata()));

                for (let j=0, len=files.length;j<len; j++) {
                    salida.push(new this(buckets[i], files[j], metadatas[j]));
                    // salida.push(new this(buckets[i], files[j], actual[2].items[j]));
                }
            }
            i++;
        }

        return salida;
    }

    /* INSTANCE */
    public contentType: string;
    public timeCreated: Date;
    public timeUpdated: Date;
    public size: Promise<number>;

    public get stream(): Readable {
        return this.file.createReadStream();
    }

    private _buffer?: Promise<Buffer>;
    public get buffer(): Promise<Buffer> {
        return this._buffer??=this.download();
    }

    public async toString(encoding: BufferEncoding = "utf-8"): Promise<string> {
        return this.buffer.then(buffer=>buffer.toString(encoding));
    }

    public constructor(public readonly bucket: string, public readonly file: File, metadata: Metadata) {
        this.contentType = metadata.contentType;
        this.timeCreated = new Date(metadata.timeCreated);
        this.timeUpdated = new Date(metadata.updated);
        this.size = Promise.resolve(parseInt(`${metadata.size??0}`));
    }

    private async download(): Promise<Buffer> {
        return this.file.download().then((response)=>response[0]);
    }

    public async delete(): Promise<void> {
        await this.file.delete();
    }
}

export class StorageError implements IDocumento {
    public timeCreated: Date;
    public timeUpdated: Date;

    public get size(): Promise<number> {
        return fileSize(this.file)
    }
    public get stream(): NodeJS.ReadableStream {
        return fs.createReadStream(this.file);
    }
    public get buffer(): Promise<Buffer> {
        return readFile(this.file);
    }

    public constructor(private readonly file: string, public readonly contentType: string) {
        this.timeCreated = new Date(0);
        this.timeUpdated = new Date(0);
    }
}

type StorageClientBuild = {
    config: Google;
    buckets?: string[];
}

export class StorageClient {
    /* STATIC */
    public static build({config, buckets = []}: StorageClientBuild): StorageClient {
        return new StorageClient(config, buckets);
    }

    /* INSTANCE */
    public constructor(private readonly config: Google, private readonly buckets: string[]) {
    }

    public async get(file: string): Promise<Storage> {
        return Storage.get(this.config, this.buckets, file);
    }
}
