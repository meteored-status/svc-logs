/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 5e0538d8e1e16fd649be6a9430a21fb9
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {TParams} from "./value";
import {Value} from "./value";

export class SingularValue<T extends TParams={}> extends Value<T> {
    /* INSTANCE */
    public constructor(protected readonly _value: string, params?: string[]) {
        super(params ?? []);
    }

    public override value(params?: Partial<T>): string {
        return this.applyParams(this._value, params)
    }
}
