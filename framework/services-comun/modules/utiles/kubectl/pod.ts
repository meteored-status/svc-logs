export interface IPod {
    name: string;
    status: string;
}

export class Pod {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly _data: IPod) {
    }

    private get data(): IPod {
        return this._data;
    }

    public get name(): string {
        return this.data.name;
    }

    private get status(): string {
        return this.data.status;
    }

    public isRunning(): boolean {
        return this.status.toLowerCase() === 'running';
    }
}
