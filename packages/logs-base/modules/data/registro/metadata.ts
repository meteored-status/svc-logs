export interface IRegistroMetadata {
    cliente: string;
    proyecto?: string;
    ingest: Date;
    pod: string;
    version: string;
    source: string;
}

export interface IRegistroMetadataES {
    cliente: string;
    proyecto?: string;
    ingest: string;
    pod: string;
    version: string;
    source: string;
}

export class RegistroMetadata implements IRegistroMetadata {
    /* STATIC */
    public static build(data: IRegistroMetadata): RegistroMetadata {
        return new this({
            cliente: data.cliente,
            proyecto: data.proyecto,
            ingest: data.ingest,
            pod: data.pod,
            version: data.version,
            source: data.source,
        });
    }

    /* INSTANCE */
    public get cliente(): string { return this.data.cliente; }
    public get proyecto(): string|undefined { return this.data.proyecto; }
    public get ingest(): Date { return this.data.ingest; }
    public get pod(): string { return this.data.pod; }
    public get version(): string { return this.data.version; }
    public get source(): string { return this.data.source; }

    protected constructor(private data: IRegistroMetadata) {
    }

    public toJSON(): IRegistroMetadataES {
        return {
            cliente: this.data.cliente,
            proyecto: this.data.proyecto,
            ingest: this.data.ingest.toISOString(),
            pod: this.data.pod,
            version: this.data.version,
            source: this.data.source,
        };
    }
}
