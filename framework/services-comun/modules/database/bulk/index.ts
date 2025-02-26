export interface BulkConfig {
    chunk?: number;
    waitToSave?: boolean;
}

export abstract class Bulk {
    /* STATIC */

    /* INSTANCE */
    private readonly _updates: any[];
    protected constructor(private readonly _config?: BulkConfig) {
        this._updates = [];
    }

    protected get config(): BulkConfig | undefined {
        return this._config;
    }

    public async run(): Promise<void> {
        await this.doUpdates(this._updates);
    }

    public update(obj: any): void {
        if (Array.isArray(obj)) {
            for (const o of obj) {
                this.update(o);
            }
        } else {
            this._updates.push(obj);
        }
    }

    protected abstract doUpdates(updates: any[]): Promise<void>;
}
