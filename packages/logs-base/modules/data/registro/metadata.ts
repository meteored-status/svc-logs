export interface IRegistroMetadata {
    proyecto: string;
    subproyecto?: string;
    // ingest: Date;
    // pod: string;
    // version: string;
    // source: string;
    // idx: number;
}

export interface IRegistroMetadataES {
    proyecto: string;
    subproyecto?: string;
    // ingest: string;
    // pod: string;
    // version: string;
    // source: string;
    // idx: number;
}

export class RegistroMetadata implements IRegistroMetadata {
    /* STATIC */
    public static build(data: IRegistroMetadata): RegistroMetadata {
        return new this({
            proyecto: data.proyecto,
            subproyecto: data.subproyecto,
            // ingest: data.ingest,
            // pod: data.pod,
            // version: data.version,
            // source: data.source,
            // idx: data.idx,
        });
    }

    /* INSTANCE */
    public get proyecto(): string { return this.data.proyecto; }
    public get subproyecto(): string|undefined { return this.data.subproyecto; }
    // public get ingest(): Date { return this.data.ingest; }
    // public get pod(): string { return this.data.pod; }
    // public get version(): string { return this.data.version; }
    // public get source(): string { return this.data.source; }
    // public get idx(): number { return this.data.idx; }

    protected constructor(private data: IRegistroMetadata) {
    }

    public toJSON(): IRegistroMetadataES {
        return {
            proyecto: this.data.proyecto,
            subproyecto: this.data.subproyecto,
            // ingest: this.data.ingest.toISOString(),
            // pod: this.data.pod,
            // version: this.data.version,
            // source: this.data.source,
            // idx: this.data.idx,
        };
    }
}
