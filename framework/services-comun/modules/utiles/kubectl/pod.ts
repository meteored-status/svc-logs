/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 20d202b65db4508f2511e64b2ad266bd
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export interface IPod {
    name: string;
    status: string;
}

export class Pod {
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
