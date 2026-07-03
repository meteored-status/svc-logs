/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 13:19:31 GMT
 * Hash: 4651eeb355d290520bc5d426bc238522
 * Versión: 2026.6.17+7-josantoniojimnez
 */

import {Value} from "./value/value";
import type {TParams} from "..";
import {Translation} from ".";

export class Literal<T extends TParams={}> extends Translation<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly _value: Value) {
        super();
    }

    public render(params?: Partial<T>): string {
        return this._value.value(params);
    }

}
