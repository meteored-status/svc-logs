/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 2cf359cc00ea9ae2a8059c4427c2c489
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

type PaginationOptions<T> = {
    loadPage: (page: number, pageSize: number) => Promise<T[]>;
}

export class Pagination<T=any> {
    /* INSTANCE */
    private _page: number;

    public constructor(private readonly pageSize: number, private readonly config: PaginationOptions<T>) {
        this._page = 0;
    }

    public async next(): Promise<T[]|false> {
        ++this._page;
        const results = await this.config.loadPage(this._page, this.pageSize);
        if (results.length < 1) {
            return false;
        }
        return results;
    }

    public get page(): number {
        return this._page;
    }
}
