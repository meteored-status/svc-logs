/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: f0649eb79e49f40830ff5d8e387c3a45
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Value} from "./value/value";
import {type TParams} from "./value/value";
import {Translation} from ".";

export class Literal<T extends TParams={}> extends Translation<T> {
    /* INSTANCE */
    public constructor(private readonly _value: Value) {
        super();
    }

    public render(params?: Partial<T>): string {
        return this._value.value(params);
    }

}
