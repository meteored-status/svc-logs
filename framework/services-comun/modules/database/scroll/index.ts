import {SortResults} from "../../elasticsearch";

export type TCloseFunction = () => Promise<void>;

export abstract class Scroll<T> {
    /* STATIC */

    /* INSTANCE */
    private readonly _id: string;
    private _control: T|undefined;
    private _close: TCloseFunction|undefined;
    protected constructor(id: string, close?: TCloseFunction) {
        this._id = id;
        this._close = close;
    }

    public get id(): string {
        return this._id;
    }

    public get control(): T|undefined {
        return this._control;
    }

    public set control(value: T|undefined) {
        this._control = value;
    }

    public async close(): Promise<void> {
        await this._close?.();
    }

}

export class ElasticSearchScroll extends Scroll<SortResults> {
    /* STATIC */

    /* INSTANCE */
    public constructor(id: string, close?: TCloseFunction) {
        super(id, close);
    }
}
