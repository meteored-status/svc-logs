type PaginationOptions<T> = {
    loadPage: (page: number, pageSize: number) => Promise<T[]>;
}

export class Pagination<T=any> {
    /* STATIC */

    /* INSTANCE */
    private _page: number = 0;
    public constructor(private readonly pageSize: number, private readonly config: PaginationOptions<T>) {
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
