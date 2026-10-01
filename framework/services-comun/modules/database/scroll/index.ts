/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 29f5c2f28515f3d4f6dc380cec925bdb
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {SortResults} from "../../elasticsearch";

export type TCloseFunction = () => Promise<void>;

export abstract class Scroll<T> {
    /* INSTANCE */
    private readonly _id: string;
    private _close: TCloseFunction | undefined;

    protected constructor(id: string, close?: TCloseFunction) {
        this._id = id;
        this._close = close;
    }

    private _control: T | undefined;

    public get control(): T | undefined {
        return this._control;
    }

    public set control(value: T | undefined) {
        this._control = value;
    }

    public get id(): string {
        return this._id;
    }

    public async close(): Promise<void> {
        await this._close?.();
    }

}

export class ElasticSearchScroll extends Scroll<SortResults> {
    /* INSTANCE */
    public constructor(id: string, close?: TCloseFunction) {
        super(id, close);
    }
}
